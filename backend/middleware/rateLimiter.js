const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Increased from 5 to 20 for development
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again later.',
    // Disable validation warnings for trust proxy (we're using ngrok in development)
    validate: {
        trustProxy: false, // Don't validate trust proxy settings
        xForwardedForHeader: false, // Don't validate X-Forwarded-For
    },
});

module.exports = limiter;
