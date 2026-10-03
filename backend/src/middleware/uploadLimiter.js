const rateLimit = require('express-rate-limit');

// Max 30 upload requests per 15 minutes per IP (admin-only route).
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many uploads. Please try again in 15 minutes.',
    });
  },
});

module.exports = uploadLimiter;
