// Two protections for every /api/admin request:
//
// 1. No caching. Admin data must never be stored by the browser or any
//    proxy, so after logging out the Back button cannot show it again.
//
// 2. Cross-site request forgery (CSRF). Besides the SameSite=strict cookie,
//    every request that changes something must carry the X-Requested-With
//    header. The site's own fetch() calls add it (frontend/src/api.js);
//    another website cannot add custom headers to a cross-site request
//    without a CORS preflight, which only our own origins pass.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function adminRequestGuard(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  if (!SAFE_METHODS.has(req.method) && !req.get('X-Requested-With')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = adminRequestGuard;
