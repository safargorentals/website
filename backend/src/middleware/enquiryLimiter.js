const rateLimit = require('express-rate-limit');
const { clientKey } = require('./rateLimitKeys');

// Strict limit for the enquiry form only: 5 submissions per hour per visitor.
// A real customer will never hit this; a bot or spammer will.
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  keyGenerator: clientKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many enquiries. Please try again in an hour.',
    });
  },
});

module.exports = enquiryLimiter;
