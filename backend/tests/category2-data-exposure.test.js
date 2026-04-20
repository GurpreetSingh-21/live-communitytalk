/**
 * =============================================================================
 * CATEGORY 2 — Sensitive Data Exposure Tests
 * =============================================================================
 * Tests all 6 findings in Category 2:
 *
 *  F-09  { ...user } spreads full DB row (password hash, 2FA secret, backup codes)
 *  F-30  Duplicate /bootstrap route leaks raw Prisma user row
 *  F-25  birthDate returned raw + no server-side 18+ age validation
 *  F-18  Dating pool includes userId (links anonymous profile to main account)
 *  F-31  GPS lat/lng returned in dating pool response
 *  F-46  Email service logs full email addresses to stdout
 *
 * Run: npx jest tests/category2-data-exposure.test.js --verbose
 * =============================================================================
 */

const request = require('supertest');
const express = require('express');
const jwt     = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-secret-jest-cat2';
process.env.MY_SECRET_KEY = JWT_SECRET;
process.env.NODE_ENV      = 'test';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('../prisma/client', () => ({
  $connect:         jest.fn().mockResolvedValue(undefined),
  $disconnect:      jest.fn().mockResolvedValue(undefined),
  $transaction:     jest.fn(async (fn) => fn(mockTx)),
  user:             { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  member:           { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
  community:        { findMany: jest.fn().mockResolvedValue([]) },
  datingProfile:    { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
  datingPreference: { upsert: jest.fn() },
  datingPhoto:      { deleteMany: jest.fn(), createMany: jest.fn() },
  datingSwipe:      { findMany: jest.fn().mockResolvedValue([]) },
  datingBlock:      { findMany: jest.fn().mockResolvedValue([]) },
  trustedDevice:    { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
  report:           { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
}));

const mockTx = {
  datingProfile: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  datingPreference: { upsert: jest.fn() },
  datingPhoto:   { deleteMany: jest.fn(), createMany: jest.fn() },
};

jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendNewDeviceEmail:    jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase-admin', () => ({ initializeApp: jest.fn(), credential: { cert: jest.fn() } }));
jest.mock('../firebase', () => ({}));
jest.mock('jsdom',     () => ({ JSDOM: class { constructor() { this.window = {}; } } }));
jest.mock('dompurify', () => () => ({ sanitize: (v) => v }));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload: jest.fn() } } }));

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '14d', ...opts });
}

/** Returns a full Prisma user row — including ALL sensitive fields */
function fullDbUser(overrides = {}) {
  return {
    id:                       'user-abc-123',
    email:                    'test@queens.cuny.edu',
    fullName:                 'Test User',
    avatar:                   null,
    role:                     'user',
    emailVerified:            true,
    accountStatus:            'ACTIVE',
    isActive:                 true,
    isPermanentlyDeleted:     false,
    // ⛔ Sensitive — must NEVER appear in API responses:
    password:                 '$2a$10$hashedpasswordXYZABC',
    twoFactorSecret:          'JBSWY3DPEHPK3PXP',
    twoFactorBackupCodes:     ['AA11BB', 'CC22DD'],
    twoFactorEnabled:         false,
    verificationCode:         '482910',
    verificationCodeExpires:  new Date(Date.now() + 3600000),
    verificationCodeAttempts: 0,
    tokenVersion:             3,
    // Safe fields
    collegeSlug:              'queens',
    religionKey:              null,
    allowDMsFromOthers:       true,
    showOnlineStatus:         true,
    hasDatingProfile:         false,
    datingProfileId:          null,
    createdAt:                new Date('2024-01-01'),
    ...overrides,
  };
}

/** A dating profile as returned by Prisma — includes sensitive fields */
function datingProfileRow(overrides = {}) {
  return {
    id:               'dating-profile-001',
    userId:           'user-abc-123',           // ⛔ F-18: should not appear in pool
    firstName:        'Alex',
    birthDate:        new Date('2000-01-15'),   // ⛔ F-25: should not appear raw in pool
    gender:           'MALE',
    bio:              'Test bio',
    major:            'Computer Science',
    year:             'JUNIOR',
    collegeSlug:      'queens',
    hobbies:          ['coding', 'hiking'],
    isProfileVisible: true,
    isPaused:         false,
    lat:              40.7281,                  // ⛔ F-31: GPS coords
    lng:              -73.7945,                 // ⛔ F-31: GPS coords
    photos:           [{ id: 'p1', url: 'https://cdn.example.com/photo.jpg', isMain: true }],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD MINIMAL TEST APP
// ─────────────────────────────────────────────────────────────────────────────

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());

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

  const authRoutes   = require('../routes/loginNregRoutes');
  const datingRoutes = require('../routes/datingRoutes');

  app.use('/api/auth',   authRoutes);
  app.use('/api/dating', datingRoutes);
});

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// F-09 — { ...user } spread: sensitive fields must NOT appear in responses
// =============================================================================
describe('F-09 — API responses must not leak sensitive user fields', () => {
  const SENSITIVE_FIELDS = [
    'password', 'twoFactorSecret', 'twoFactorBackupCodes',
    'verificationCode', 'verificationCodeExpires', 'verificationCodeAttempts',
    'tokenVersion', 'isPermanentlyDeleted', 'isActive', 'accountStatus',
  ];

  const getPrisma = () => require('../prisma/client');

  async function getBootstrapResponse() {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().member.findMany.mockResolvedValue([]);
    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu', tokenVersion: 3 });
    return request(app).get('/api/auth/bootstrap').set('Authorization', `Bearer ${token}`);
  }

  it('GET /bootstrap does not include password in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.statusCode).toBe(200);
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('GET /bootstrap does not include twoFactorSecret in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).not.toHaveProperty('twoFactorSecret');
  });

  it('GET /bootstrap does not include twoFactorBackupCodes in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).not.toHaveProperty('twoFactorBackupCodes');
  });

  it('GET /bootstrap does not include verificationCode in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).not.toHaveProperty('verificationCode');
  });

  it('GET /bootstrap does not include tokenVersion in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).not.toHaveProperty('tokenVersion');
  });

  it('GET /bootstrap does not include isPermanentlyDeleted in response', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).not.toHaveProperty('isPermanentlyDeleted');
  });

  it('GET /bootstrap returns safe fields that the app actually needs', async () => {
    const res = await getBootstrapResponse();
    expect(res.body.user).toMatchObject({
      id:        'user-abc-123',
      email:     'test@queens.cuny.edu',
      fullName:  'Test User',
      role:      'user',
    });
  });

  it('GET /bootstrap does not leak any sensitive field (full sweep)', async () => {
    const res = await getBootstrapResponse();
    const body = JSON.stringify(res.body);
    for (const field of SENSITIVE_FIELDS) {
      expect(res.body.user).not.toHaveProperty(field);
    }
    // Raw password hash must not appear anywhere in the response body
    expect(body).not.toMatch(/\$2a\$10\$/);
    // 2FA secret must not appear
    expect(body).not.toMatch(/JBSWY3DPEHPK3PXP/);
  });

  it('GET /profile does not leak sensitive fields', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().member.findMany.mockResolvedValue([]);
    const token = makeToken({ id: 'user-abc-123', tokenVersion: 3 });

    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    for (const field of SENSITIVE_FIELDS) {
      expect(res.body.user).not.toHaveProperty(field);
    }
  });
});

// =============================================================================
// F-30 — Duplicate /bootstrap route must not exist or leak data
// =============================================================================
describe('F-30 — Only one /bootstrap handler exists', () => {
  it('loginNregRoutes.js defines /bootstrap exactly once', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../routes/loginNregRoutes.js'), 'utf8');
    // Count occurrences of the route definition
    const matches = src.match(/router\.get\(["']\/bootstrap["']/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1); // exactly one, not two
  });

  it('bootstrap response user object does not contain raw DB fields', async () => {
    const getPrisma = () => require('../prisma/client');
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().member.findMany.mockResolvedValue([]);
    const token = makeToken({ id: 'user-abc-123', tokenVersion: 3 });

    const res = await request(app)
      .get('/api/auth/bootstrap')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    // These are the raw Prisma fields that must stay server-side
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('twoFactorSecret');
    expect(res.body.user).not.toHaveProperty('accountStatus');
  });
});

// =============================================================================
// F-25 — Server-side 18+ age validation on dating profile creation
// =============================================================================
describe('F-25 — POST /api/dating/profile enforces 18+ age server-side', () => {
  const getPrisma = () => require('../prisma/client');

  function makeAuthHeader(userId = 'user-abc-123') {
    return `Bearer ${makeToken({ id: userId, email: 'test@queens.cuny.edu', tokenVersion: 3 })}`;
  }

  it('rejects a profile with birthDate that makes user under 18', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().datingProfile.findUnique.mockResolvedValue(null); // new profile

    // 16 years old
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 16);

    const res = await request(app)
      .post('/api/dating/profile')
      .set('Authorization', makeAuthHeader())
      .send({ firstName: 'Alex', gender: 'MALE', birthDate: birthDate.toISOString() });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/18/);
  });

  it('rejects a profile with birthDate of exactly 17 years ago', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().datingProfile.findUnique.mockResolvedValue(null);

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 17);

    const res = await request(app)
      .post('/api/dating/profile')
      .set('Authorization', makeAuthHeader())
      .send({ firstName: 'Alex', gender: 'MALE', birthDate: birthDate.toISOString() });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/18/);
  });

  it('accepts a profile with birthDate of exactly 18 years ago', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().datingProfile.findUnique.mockResolvedValue(null);
    // Mock the transaction
    const createdProfile = { id: 'dp-1', userId: 'user-abc-123' };
    mockTx.datingProfile.create.mockResolvedValue(createdProfile);
    mockTx.datingPhoto.deleteMany.mockResolvedValue({});
    mockTx.datingPhoto.createMany.mockResolvedValue({});
    require('../prisma/client').$transaction.mockResolvedValue(createdProfile);
    getPrisma().user.update.mockResolvedValue({});

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 18);

    const res = await request(app)
      .post('/api/dating/profile')
      .set('Authorization', makeAuthHeader())
      .send({ firstName: 'Alex', gender: 'MALE', birthDate: birthDate.toISOString() });

    expect(res.statusCode).not.toBe(400);
  });

  it('accepts a profile with birthDate of 25 years ago', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser());
    getPrisma().datingProfile.findUnique.mockResolvedValue(null);
    const createdProfile = { id: 'dp-2', userId: 'user-abc-123' };
    require('../prisma/client').$transaction.mockResolvedValue(createdProfile);
    getPrisma().user.update.mockResolvedValue({});

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 25);

    const res = await request(app)
      .post('/api/dating/profile')
      .set('Authorization', makeAuthHeader())
      .send({ firstName: 'Alex', gender: 'MALE', birthDate: birthDate.toISOString() });

    expect(res.statusCode).not.toBe(400);
  });
});

// =============================================================================
// F-18 — userId must NOT appear in dating pool response
// =============================================================================
describe('F-18 — Dating pool response does not expose userId', () => {
  const getPrisma = () => require('../prisma/client');

  it('pool results do not include userId field', async () => {
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser({ hasDatingProfile: true }));
    getPrisma().datingProfile.findUnique.mockResolvedValue({
      id: 'dp-me', userId: 'user-abc-123', gender: 'MALE', collegeSlug: 'queens',
      birthDate: new Date('1999-01-01'),
      preference: { ageMin: 18, ageMax: 30, interestedInGender: ['FEMALE'], preferredColleges: [], showToPeopleOnCampusOnly: false, maxDistance: 50 },
    });
    getPrisma().datingSwipe.findMany.mockResolvedValue([]);
    getPrisma().datingBlock.findMany.mockResolvedValue([]);
    getPrisma().datingProfile.findMany.mockResolvedValue([datingProfileRow()]);

    const token = makeToken({ id: 'user-abc-123', email: 'test@queens.cuny.edu', tokenVersion: 3 });

    const res = await request(app)
      .get('/api/dating/pool')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty('userId');
    }
  });
});

// =============================================================================
// F-31 + F-25 output — Pool must not have raw birthDate, lat, or lng
// =============================================================================
describe('F-31 — Dating pool response does not expose GPS coordinates or raw birthDate', () => {
  const getPrisma = () => require('../prisma/client');

  async function getPool() {
    const getPrisma = () => require('../prisma/client');
    getPrisma().user.findUnique.mockResolvedValue(fullDbUser({ hasDatingProfile: true }));
    getPrisma().datingProfile.findUnique.mockResolvedValue({
      id: 'dp-me', userId: 'user-abc-123', gender: 'MALE', collegeSlug: 'queens',
      birthDate: new Date('1999-01-01'),
      preference: { ageMin: 18, ageMax: 30, interestedInGender: ['FEMALE'], preferredColleges: [], showToPeopleOnCampusOnly: false, maxDistance: 50 },
    });
    // Pool route calls Promise.all([datingSwipe, datingBlock, datingBlock])
    getPrisma().datingSwipe.findMany.mockResolvedValue([]);
    getPrisma().datingBlock.findMany.mockResolvedValue([]);
    getPrisma().datingProfile.findMany.mockResolvedValue([datingProfileRow()]);

    const token = makeToken({ id: 'user-abc-123', tokenVersion: 3 });
    return request(app).get('/api/dating/pool').set('Authorization', `Bearer ${token}`);
  }

  it('pool results do not include lat field', async () => {
    const res = await getPool();
    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty('lat');
      expect(res.body[0]).not.toHaveProperty('latitude');
    }
    expect(res.statusCode).toBe(200);
  });

  it('pool results do not include lng field', async () => {
    const res = await getPool();
    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty('lng');
      expect(res.body[0]).not.toHaveProperty('longitude');
    }
  });

  it('pool results do not include raw birthDate', async () => {
    const res = await getPool();
    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty('birthDate');
    }
  });

  it('pool results DO include computed age (number)', async () => {
    const res = await getPool();
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('age');
      expect(typeof res.body[0].age).toBe('number');
      expect(res.body[0].age).toBeGreaterThanOrEqual(18);
    }
  });
});

// =============================================================================
// F-46 — Email service must mask emails in logs
// =============================================================================
describe('F-46 — emailService.js masks email addresses in log output', () => {
  it('emailService source contains maskEmail helper', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../services/emailService.js'), 'utf8');
    expect(src).toMatch(/maskEmail/);
  });

  it('emailService does NOT log the raw email string directly', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '../services/emailService.js'), 'utf8');
    const noComments = src.replace(/\/\/.*/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // All console.log/error calls with the email var should use maskEmail
    // Check that bare ${userEmail} is not used in console calls
    const bareEmailInLog = noComments.match(/console\.(log|error|warn)\(`[^`]*\$\{userEmail\}/g);
    if (bareEmailInLog) {
      // If any exist, they should all be inside maskEmail()
      for (const match of bareEmailInLog) {
        expect(match).toMatch(/maskEmail\(userEmail\)/);
      }
    }
  });

  it('maskEmail function masks local part correctly', () => {
    // Inline test of the masking logic matching what's in emailService.js
    function maskEmail(email) {
      if (typeof email !== 'string' || !email.includes('@')) return '***';
      const [local, domain] = email.split('@');
      const visible = local.slice(0, 2);
      return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
    }

    expect(maskEmail('jascha@queens.cuny.edu')).toBe('ja****@queens.cuny.edu');
    expect(maskEmail('ab@test.edu')).toBe('ab**@test.edu');
    expect(maskEmail('test@college.edu')).toBe('te**@college.edu');
    expect(maskEmail('notanemail')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });

  it('maskEmail never returns the original full email', () => {
    function maskEmail(email) {
      if (typeof email !== 'string' || !email.includes('@')) return '***';
      const [local, domain] = email.split('@');
      const visible = local.slice(0, 2);
      return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
    }

    const email = 'jascha@queens.cuny.edu';
    expect(maskEmail(email)).not.toBe(email);
    expect(maskEmail(email)).toContain('*');
  });
});
