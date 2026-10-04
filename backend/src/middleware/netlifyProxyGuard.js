const jwt = require('jsonwebtoken');
const env = require('../config/env');

// When NETLIFY_PROXY_SECRET is set, only requests forwarded by our Netlify
// site are served: Netlify signs each proxied request (x-nf-sign header, a
// JWT signed with the shared secret - see "signed" in frontend/netlify.toml).
// Calling the Render URL directly then gets 403, so nobody can skip Netlify
// or fake the visitor IP that the rate limiters rely on.
// /api/health stays open for Render's health check.
// Without the secret this does nothing (the site keeps working as before).
function netlifyProxyGuard(req, res, next) {
  if (!env.netlifyProxySecret || req.path === '/health') return next();
  const signature = req.get('x-nf-sign');
  try {
    jwt.verify(signature || '', env.netlifyProxySecret, { algorithms: ['HS256'] });
    return next();
  } catch {
    return res.status(403).json({ error: 'Forbidden' });
  }
}

module.exports = netlifyProxyGuard;
