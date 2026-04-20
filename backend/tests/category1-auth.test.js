/**
 * =============================================================================
 * CATEGORY 1 — Authentication & Session Security Tests
 * =============================================================================
 * Tests all 7 Category 1 findings:
 *
 *  F-02  OTP has no expiry + no rate limit
 *  F-05  14-day JWTs, no logout / token revocation
 *  F-06  Login doesn't check accountStatus (banned users can log in)
 *  F-11  2FA backup codes use Math.random() instead of crypto
 *  F-32  Admin login has no 2FA enforcement
 *  F-37  authenticate middleware never checks accountStatus
 *  F-40  Auto-ban doesn't set accountStatus:'BANNED'
 *
 * Strategy: Build a minimal Express app with only the relevant routes.
 * This avoids loading server.js (which requires live Redis + Postgres).
 *
 * Run: npx jest tests/category1-auth.test.js --verbose
 * =============================================================================
 */

const request = require('supertest');
const express = require('express');
const jwt     = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-secret-jest-cat1';
process.env.MY_SECRET_KEY   = JWT_SECRET;
process.env.NODE_ENV        = 'test';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS  (must come before any require() of the modules being mocked)
// ─────────────────────────────────────────────────────────────────────────────

// 1. Prisma
jest.mock('../prisma/client', () => ({
  $connect:      jest.fn().mockResolvedValue(undefined),
  $disconnect:   jest.fn().mockResolvedValue(undefined),
  user:          { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn() },
  member:        { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
  community:     { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  trustedDevice: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(), update: jest.fn() },
  report:        { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'r1' }) },
  moderationLog: { create: jest.fn().mockResolvedValue({}) },
  datingProfile: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
}));

// 2. Email service
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendNewDeviceEmail:    jest.fn().mockResolvedValue(undefined),
}));

// 3. Firebase (admin SDK)
jest.mock('firebase-admin', () => ({ initializeApp: jest.fn(), credential: { cert: jest.fn() } }));
jest.mock('../firebase', () => ({}));

// 4. DOMPurify / JSDOM (ESM modules need manual mock)
jest.mock('jsdom',     () => ({ JSDOM: class { constructor() { this.window = {}; } } }));
jest.mock('dompurify', () => () => ({ sanitize: (v) => v }));

// 5. Cloudinary / upload (not needed in auth tests)
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload: jest.fn() } } }));

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Make a real signed JWT */
function makeToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '14d', ...opts });
}

/** Fully active user record (as returned by Prisma) */
function activeUser(overrides = {}) {
  return {
    id:                       'user-abc-123',
    email:                    'test@queens.cuny.edu',
    password:                 '$2a$10$placeholder',
    fullName:                 'Test User',
    role:                     'user',
    emailVerified:            true,
    accountStatus:            'ACTIVE',
    isActive:                 true,
    isPermanentlyDeleted:     false,
    twoFactorEnabled:         false,
    twoFactorSecret:          null,
    twoFactorBackupCodes:     [],
    verificationCode:         null,
    verificationCodeExpires:  null,
    verificationCodeAttempts: 0,
    tokenVersion:             0,
    hasDatingProfile:         false,
    datingProfileId:          null,
    collegeSlug:              'queens',
    religionKey:              null,
    pushTokens:               [],
    reportsReceivedCount:     0,
    ...overrides,
  };
}

function adminUser(overrides = {}) {
  return activeUser({ id: 'admin-xyz-456', email: 'admin@queens.cuny.edu', role: 'admin', ...overrides });
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD MINIMAL TEST APP  (no server.js — just the relevant routes)
// ─────────────────────────────────────────────────────────────────────────────

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Inject mock Redis client on every request
  app.use((req, _res, next) => {
    req.redisClient = {
      get:    jest.fn().mockResolvedValue(null),
      setex:  jest.fn().mockResolvedValue('OK'),
      set:    jest.fn().mockResolvedValue('OK'),
      del:    jest.fn().mockResolvedValue(1),
      incr:   jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    req.io = { to: () => ({ emit: jest.fn() }) };
    next();
  });

  // Mount only the routes under test
  const authenticate    = require('../middleware/authenticate');
  const authRoutes      = require('../routes/loginNregRoutes');
  const adminRoutes     = require('../routes/adminRoutes');
  const twoFactorRoutes = require('../routes/twoFactorRoutes');
  const reportRoutes    = require('../routes/userReportRoutes');

  app.use('/api/auth',    authRoutes);
  app.use('/api/admin',   adminRoutes);
  app.use('/api/2fa',     twoFactorRoutes);
  app.use('/api/reports', reportRoutes);

  // A simple protected ping to test authenticate middleware directly
  app.get('/api/ping', authenticate, (_req, res) => res.json({ ok: true }));
});

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// F-37 — authenticate middleware blocks banned users
// =============================================================================
describe('F-37 — authenticate blocks banned/suspended/deleted users with valid JWT', () => {
  const getPrisma = () => require('../prisma/client');

  it('returns 403 (USER_BANNED) when accountStatus is BANNED', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ accountStatus: 'BANNED' }));
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu' });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('USER_BANNED');
  });

  it('returns 403 when isActive is false', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ isActive: false }));
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu' });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when isPermanentlyDeleted is true', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ isPermanentlyDeleted: true }));
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu' });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 (NO_TOKEN) when no Authorization header', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('returns 401 (TOKEN_INVALID) for a tampered token', async () => {
    const res = await request(app)
      .get('/api/ping')
      .set('Authorization', 'Bearer this.is.garbage');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    require('../prisma/client').user.findUnique.mockResolvedValue(null);
    const expiredToken = makeToken({ id: 'user-abc-123' }, { expiresIn: '-1s' });
    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${expiredToken}`);
    // Must be 401 — either TOKEN_EXPIRED or USER_NOT_FOUND depending on middleware order
    expect(res.statusCode).toBe(401);
  });

  it('allows access for a fully active user with valid token', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser());
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu', tokenVersion: 0 });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects token sent as query param (?token=...) — security fix', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser());
    const token = makeToken({ id: 'user-abc-123' });

    // No Authorization header — token only in query param
    const res = await request(app).get(`/api/ping?token=${token}`);
    expect(res.statusCode).toBe(401); // must NOT authenticate via query param
  });
});

// =============================================================================
// F-05 — tokenVersion invalidation (old tokens rejected after logout/rotate)
// =============================================================================
describe('F-05 — tokenVersion mismatch rejects stale JWTs (session revocation)', () => {
  const getPrisma = () => require('../prisma/client');

  it('rejects a token whose tokenVersion is older than the DB value', async () => {
    // DB says version=2 (user changed password or logged out all devices)
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ tokenVersion: 2 }));
    // Token was issued at version 0 (before the reset)
    const oldToken = makeToken({ id: 'user-abc-123', tokenVersion: 0 });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${oldToken}`);
    expect([401, 403]).toContain(res.statusCode);
  });

  it('accepts a token whose tokenVersion matches the DB', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ tokenVersion: 3 }));
    const currentToken = makeToken({ id: 'user-abc-123', tokenVersion: 3 });

    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${currentToken}`);
    expect(res.statusCode).toBe(200);
  });
});

// =============================================================================
// F-06 — Login must reject banned/deleted accounts before checking password
// =============================================================================
describe('F-06 — POST /api/auth/login rejects banned accounts', () => {
  const getPrisma = () => require('../prisma/client');

  it('returns 403 for BANNED account (correct password)', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Password1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ accountStatus: 'BANNED', password: hash }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@queens.cuny.edu', password: 'Password1!' });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/banned/i);
  });

  it('returns 403 for isActive=false account', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Password1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ isActive: false, password: hash }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@queens.cuny.edu', password: 'Password1!' });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 for wrong password on active account', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPassword!', 10);
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ password: hash }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@queens.cuny.edu', password: 'WrongPassword!' });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@queens.cuny.edu' }); // no password

    expect(res.statusCode).toBe(400);
  });
});

// =============================================================================
// F-02 — OTP must expire + limit attempts
// =============================================================================
describe('F-02 — POST /api/auth/verify-code enforces OTP expiry and attempt limits', () => {
  const getPrisma = () => require('../prisma/client');

  it('returns 400 for an expired OTP', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({
      emailVerified:            false,
      verificationCode:         '111111',
      verificationCodeExpires:  new Date(Date.now() - 5000), // expired 5s ago
      verificationCodeAttempts: 0,
    }));

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'test@queens.cuny.edu', code: '111111' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('returns 400 (max attempts) after 5 failed tries', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({
      emailVerified:            false,
      verificationCode:         '222222',
      verificationCodeExpires:  new Date(Date.now() + 60000),
      verificationCodeAttempts: 5, // at the ceiling
    }));

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'test@queens.cuny.edu', code: '000000' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/attempt/i);
  });

  it('increments attempt counter on a wrong code', async () => {
    getPrisma().user.findUnique.mockResolvedValue(activeUser({
      emailVerified:            false,
      verificationCode:         '333333',
      verificationCodeExpires:  new Date(Date.now() + 60000),
      verificationCodeAttempts: 2,
    }));
    getPrisma().user.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'test@queens.cuny.edu', code: '000000' });

    expect(res.statusCode).toBe(400);
    expect(getPrisma().user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationCodeAttempts: expect.objectContaining({ increment: 1 }),
      }),
    }));
  });

  it('clears OTP fields after successful verification', async () => {
    const user = activeUser({
      emailVerified:            false,
      verificationCode:         '444444',
      verificationCodeExpires:  new Date(Date.now() + 60000),
      verificationCodeAttempts: 0,
    });
    getPrisma().user.findUnique.mockResolvedValue(user);
    getPrisma().user.update.mockResolvedValue({ ...user, emailVerified: true });
    getPrisma().member.findMany.mockResolvedValue([]);

    await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'test@queens.cuny.edu', code: '444444' });

    expect(getPrisma().user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        emailVerified:            true,
        verificationCode:         null,
        verificationCodeExpires:  null,
        verificationCodeAttempts: 0,
      }),
    }));
  });

  it('returns 200 + token for a valid OTP within the window', async () => {
    const user = activeUser({
      emailVerified:            false,
      verificationCode:         '555555',
      verificationCodeExpires:  new Date(Date.now() + 60000),
      verificationCodeAttempts: 0,
    });
    getPrisma().user.findUnique.mockResolvedValue(user);
    getPrisma().user.update.mockResolvedValue({ ...user, emailVerified: true });
    getPrisma().member.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'test@queens.cuny.edu', code: '555555' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

// =============================================================================
// F-32 — Admin login must require 2FA when twoFactorEnabled
// =============================================================================
describe('F-32 — POST /api/admin/login enforces 2FA challenge', () => {
  const getPrisma = () => require('../prisma/client');

  it('returns requires2FA + tempToken when admin has 2FA enabled', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('AdminPass1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(adminUser({ password: hash, twoFactorEnabled: true }));

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@queens.cuny.edu', password: 'AdminPass1!' });

    expect(res.statusCode).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body).toHaveProperty('tempToken');
    expect(res.body.token).toBeUndefined(); // no full token without 2FA
  });

  it('issues full token when admin has 2FA disabled', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('AdminPass1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(adminUser({ password: hash, twoFactorEnabled: false }));

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@queens.cuny.edu', password: 'AdminPass1!' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 403 for a non-admin user trying admin login', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Password1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(activeUser({ password: hash, role: 'user' }));

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'test@queens.cuny.edu', password: 'Password1!' });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it('returns 401 for wrong password', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPass1!', 10);
    getPrisma().user.findUnique.mockResolvedValue(adminUser({ password: hash }));

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@queens.cuny.edu', password: 'WrongPass!' });

    expect(res.statusCode).toBe(401);
  });
});

// =============================================================================
// F-11 — 2FA backup codes must use crypto.randomBytes (NOT Math.random)
// =============================================================================
describe('F-11 — 2FA backup codes use crypto, not Math.random', () => {
  it('twoFactorRoutes.js uses crypto.randomBytes for backup codes', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/twoFactorRoutes.js'), 'utf8');
    // Must use crypto
    expect(src).toMatch(/crypto\.randomBytes/);
  });

  it('twoFactorRoutes.js does NOT use Math.random() for code generation', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/twoFactorRoutes.js'), 'utf8');
    // Strip comments before checking
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toMatch(/Math\.random\(\)/);
  });

  it('twoFactorRoutes.js hashes backup codes with bcrypt before saving', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/twoFactorRoutes.js'), 'utf8');
    expect(src).toMatch(/bcrypt\.hash/);
  });
});

// =============================================================================
// F-40 — Auto-ban must set accountStatus:'BANNED'
// =============================================================================
describe('F-40 — Auto-ban logic sets accountStatus:BANNED and uses uppercase PENDING', () => {
  it('userReportRoutes.js sets accountStatus:"BANNED" when auto-banning', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/userReportRoutes.js'), 'utf8');
    expect(src).toMatch(/accountStatus.*BANNED|BANNED.*accountStatus/);
  });

  it('userReportRoutes.js uses uppercase PENDING enum (not lowercase pending)', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/userReportRoutes.js'), 'utf8');
    const noComments = src.replace(/\/\/.*/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Must NOT have any lowercase 'pending' as a status value
    expect(noComments).not.toMatch(/status:\s*'pending'/);
    // Must use uppercase PENDING
    expect(noComments).toMatch(/status:\s*'PENDING'/);
  });

  it('blocks self-reporting', async () => {
    require('../prisma/client').user.findUnique.mockResolvedValue(activeUser());
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu', tokenVersion: 0 });

    const res = await request(app)
      .post('/api/reports/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportedUserId: 'user-abc-123', reason: 'Spam' }); // same ID as token

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });
});
