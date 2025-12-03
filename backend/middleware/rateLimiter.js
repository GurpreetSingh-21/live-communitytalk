const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests, please try again later.',
    },
    // Disable validation warnings for trust proxy (we're using ngrok in development)
    validate: {
        trustProxy: false, // Don't validate trust proxy settings
        xForwardedForHeader: false, // Don't validate X-Forwarded-For
    },
});

module.exports = limiter;
