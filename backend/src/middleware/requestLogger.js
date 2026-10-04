const env = require('../config/env');

// Safe request logging for production: method, path WITHOUT the query
// string, status code and response time. Request bodies, cookies, headers
// and query strings are never logged. Inactive outside of production.
function requestLogger(req, res, next) {
  if (!env.isProduction) return next();
  const start = process.hrtime.bigint();
  // Capture the path NOW: Express rewrites req.url to the part left of the
  // route's mount point, so reading it later (on "finish") would show the
  // shortened path instead of the full one.
  const path = req.path;
  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    console.log(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
  });
  next();
}

module.exports = requestLogger;
