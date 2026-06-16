const rateLimit = require('express-rate-limit');

// Global limiter — applies to all routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
});

// Strict limiter for authentication endpoints (login, password reset, etc.)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 attempts in prod, relaxed in dev
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many attempts. Please try again in 15 minutes.',
});

module.exports = { limiter, authLimiter };
