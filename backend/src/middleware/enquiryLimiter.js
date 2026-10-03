const rateLimit = require('express-rate-limit');

// Strict limit for the enquiry form only: 5 submissions per hour per IP.
// A real customer will never hit this; a bot or spammer will.
// Needs app.set('trust proxy', 1) in server.js to see the real client IP.
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many enquiries. Please try again in an hour.',
    });
  },
});

module.exports = enquiryLimiter;
