const rateLimit = require('express-rate-limit');
const { clientKey, connectionKey } = require('./rateLimitKeys');

// Three limits on FAILED logins (skipSuccessfulRequests: a successful login
// does not count, so a real admin is never blocked by their own logins):
//   - 5 per 15 minutes per visitor IP
//   - 30 per 15 minutes per connecting address (cannot be dodged by faking IPs)
//   - 10 per hour per account email, so one admin account cannot be
//     brute-forced from many IPs at once
function tooMany(req, res) {
  res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
}

const common = {
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany,
};

const perClient = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 5, keyGenerator: clientKey });

const perConnection = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `login:${connectionKey(req)}`,
});

// The body is already parsed by express.json(); a missing or odd email
// shares one bucket, which only ever affects broken requests.
const perEmail = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `email:${email.slice(0, 254)}`;
  },
});

module.exports = [perConnection, perClient, perEmail];
