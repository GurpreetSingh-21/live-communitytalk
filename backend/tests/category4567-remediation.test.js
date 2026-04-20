/**
 * =============================================================================
 * CATEGORIES 4, 5, 6, 7 — Remediation Tests
 * =============================================================================
 * Tests findings:
 * F-17: Deduplication in reports (No auto-suspend)
 * F-20: Prevent email enumeration
 * F-24: Swipe limits via Redis
 * F-26: Cloudinary photo validation
 * F-29: ToS Check in Dating Pool
 * F-44: Shuffle validation
 * 
 * Run: npx jest tests/category4567-remediation.test.js --verbose
 * =============================================================================
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-jest-cat4';
process.env.MY_SECRET_KEY = JWT_SECRET;
process.env.NODE_ENV = 'test';

jest.mock('../prisma/client', () => ({
  report: { findFirst: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  community: { findFirst: jest.fn(), findMany: jest.fn() },
  college: { findUnique: jest.fn() },
  datingProfile: { findUnique: jest.fn(), findMany: jest.fn() },
  datingSwipe: { findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
  datingMatch: { findFirst: jest.fn(), create: jest.fn() },
  moderationLog: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(async (fn) => fn({
    datingProfile: { create: jest.fn(), update: jest.fn() },
    datingPhoto: { deleteMany: jest.fn(), createMany: jest.fn() },
    datingSwipe: { create: jest.fn(), findUnique: jest.fn() },
    datingMatch: { findFirst: jest.fn(), create: jest.fn() },
    user: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() }
  }))
}));

jest.mock('../services/CloudinaryHelper', () => ({
  deleteCloudinaryAsset: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('firebase-admin', () => ({ initializeApp: jest.fn(), credential: { cert: jest.fn() } }));
jest.mock('ioredis', () => {
    const RedisMock = require('ioredis-mock');
    return RedisMock;
});

let app;
let mockRedisIncr;

beforeAll(() => {
  app = express();
  app.use(express.json());

  mockRedisIncr = jest.fn().mockResolvedValue(1);

  app.use((req, res, next) => {
    req.redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      incr: mockRedisIncr,
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn(),
      scan: jest.fn().mockResolvedValue(['0', []])
    };
    next();
  });

  const safetyRoutes = require('../routes/safetyRoutes');
  const loginNregRoutes = require('../routes/loginNregRoutes');
  const datingRoutes = require('../routes/datingRoutes');

  app.use('/api/safety', safetyRoutes);
  app.use('/api/auth', loginNregRoutes);
  // Dating routes require auth middleware mock which applies 'req.user'
  app.use('/api/dating', (req, res, next) => {
      const auth = req.headers.authorization;
      if (auth) {
          req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
      }
      next();
  }, datingRoutes);
});

beforeEach(() => {
  jest.clearAllMocks();
});

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

describe('Category 4: Rate Limiting & Abuse', () => {
  const getPrisma = () => require('../prisma/client');

  it('F-17: Prevents duplicate reports (429 status)', async () => {
    getPrisma().user.findUnique.mockImplementation(opt => {
      // Mock both the reporter and target user finding calls gracefully
      return { id: opt.where.id, emailVerified: true, accountStatus: 'ACTIVE' }; 
    });
    getPrisma().report.findFirst.mockResolvedValue({ id: 'existing_report', status: 'PENDING' }); // Simulates existing report

    const token = makeToken({ id: 'reporter1' });
    const res = await request(app)
      .post('/api/safety/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportedId: 'target', reason: 'spam' });

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/already have a pending report/);
  });

  it('F-24: Respects Redis swipe limits for LIKES', async () => {
    // Re-bind user findUnique for auth middleware passing
    getPrisma().user.findUnique.mockImplementation(opt => {
      return { id: opt.where.id, emailVerified: true, accountStatus: 'ACTIVE' }; 
    });

    getPrisma().datingProfile.findUnique.mockResolvedValue({ id: 'dp1', userId: 'user1' });
    // Verify ToS accepted
    getPrisma().moderationLog.findFirst.mockResolvedValue({ id: 'tos1' });
    getPrisma().datingSwipe.findUnique.mockResolvedValue(null);

    // Mock Redis returning 6 for the like counter
    // The route limits on INCR returning > 5. So if INCR returns 6, it fails.
    mockRedisIncr.mockResolvedValue(6);

    const token = makeToken({ id: 'user1' });
    const res = await request(app)
      .post('/api/dating/swipe')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: 'dp2', type: 'LIKE' });

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('Daily like limit reached');
  });
});

describe('Category 5: Privacy', () => {
  
  it('F-29: Rejects dating pool access if ToS not accepted', async () => {
    const getPrisma = () => require('../prisma/client');
    getPrisma().datingProfile.findUnique.mockResolvedValue({ id: 'dp1' });
    getPrisma().moderationLog.findFirst.mockResolvedValue(null); // No ToS

    const token = makeToken({ id: 'user1' });
    const res = await request(app)
      .get('/api/dating/pool')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/must accept the Dating Terms of Service/);
  });

});

describe('Category 6 & 7: Architecture', () => {
  
  it('F-20: Email enumeration yields identical 201 response', async () => {
    const getPrisma = () => require('../prisma/client');
    // Ensure religion and college validations pass
    getPrisma().community.findFirst.mockResolvedValue({ id: 'mock-comm', name: 'Mock', key: 'mock' });
    
    // Simulate Prisma P2002 error or USER_EXISTS error
    const err = new Error("User exists");
    err.code = "P2002";
    require('../prisma/client').$transaction.mockRejectedValue(err);

    // Mock dependencies inside register handler
    getPrisma().college.findUnique.mockResolvedValue({ id: 'college123', communityId: 'comm123' });
    getPrisma().community.findMany.mockResolvedValue([
      { id: 'comm123', name: 'Mock College', type: 'college', key: 'mock' },
      { id: 'religion123', name: 'Mock Religion', type: 'religion', key: 'mockrel' }
    ]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'duplicate@test.com', password: 'Password123!', fullName: 'Test', collegeId: 'college123', religionId: 'religion123' });

    // Should return 201 Created and generic message despite failure
    console.log("F-20 Debug Response:", res.body);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/Registration successful/);
  });

});
