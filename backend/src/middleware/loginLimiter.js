const rateLimit = require('express-rate-limit');

// Max 5 FAILED login attempts per 15 minutes per IP.
// skipSuccessfulRequests: a successful login does not count, so normal
// logins are never blocked by this limiter.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

module.exports = loginLimiter;
