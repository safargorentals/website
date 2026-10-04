const rateLimit = require('express-rate-limit');
const { clientKey, connectionKey } = require('./rateLimitKeys');

const WINDOW = 15 * 60 * 1000; // 15 minutes

function tooMany(req, res) {
  res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
}

const common = { windowMs: WINDOW, standardHeaders: 'draft-7', legacyHeaders: false, handler: tooMany };

// Public pages (cars, car types, ...): 300 requests per 15 minutes per
// visitor - far more than browsing the site needs.
const publicLimiter = rateLimit({
  ...common,
  limit: 300,
  keyGenerator: clientKey,
  skip: (req) => req.path.startsWith('/admin'),
});

// Signed-in admin work makes more calls (lists, saves, uploads), so the
// admin API has its own, higher budget.
const adminLimiter = rateLimit({
  ...common,
  limit: 600,
  keyGenerator: (req) => `admin:${clientKey(req)}`,
});

// Hard cap per connecting address across the whole API (see
// rateLimitKeys.js). Stops a single source flooding the server even if it
// fakes visitor IPs.
const connectionLimiter = rateLimit({
  ...common,
  limit: 3000,
  keyGenerator: connectionKey,
});

module.exports = { publicLimiter, adminLimiter, connectionLimiter };
