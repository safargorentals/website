require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./src/config/env');
const apiRoutes = require('./src/routes');
const requestLogger = require('./src/middleware/requestLogger');
const netlifyProxyGuard = require('./src/middleware/netlifyProxyGuard');
const adminRequestGuard = require('./src/middleware/adminRequestGuard');
const { publicLimiter, adminLimiter, connectionLimiter } = require('./src/middleware/apiLimiter');
const notFound = require('./src/middleware/notFound');
const errorHandler = require('./src/middleware/errorHandler');
const sheetSyncTrigger = require('./src/middleware/sheetSyncTrigger');
const { startSheetSync } = require('./src/services/sheetSync');

const app = express();

// Render puts our app behind a proxy (and Netlify adds another when it
// proxies /api). Trust exactly that many hops so rate limiting sees the
// real client IP instead of a proxy's.
app.set('trust proxy', env.trustProxyHops);

// In production: one line per request - method, path (no query string),
// status and time. No bodies, cookies, headers or query strings.
app.use(requestLogger);

// Basic security headers for every response. Car photos come from
// Cloudinary (or any https URL an admin pastes), so allow https images.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 'img-src': ["'self'", 'data:', 'https:'] },
    },
  })
);

// Only allow requests coming from your frontend. FRONTEND_URL may list one
// or several comma-separated origins; only those exact origins get CORS
// headers (never "*"). Anything else - and requests with no Origin - gets
// no CORS headers at all. Credentials are allowed so the httpOnly admin
// cookie can travel with cross-origin requests.
function corsOrigin(origin, callback) {
  if (origin && env.frontendOrigins.includes(origin)) {
    return callback(null, origin); // allowed: respond with this exact origin
  }
  return callback(null, false); // not allowed: send no CORS headers at all
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  })
);

// Read request bodies sent as JSON (max 10 KB) and as cookies
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Only serve requests that came through our Netlify site (once
// NETLIFY_PROXY_SECRET is set - see the middleware)
app.use('/api', netlifyProxyGuard);

// Rate limits (see src/middleware/apiLimiter.js): a hard cap per connecting
// address, then a budget per visitor - one for public pages, a larger one
// for the admin panel. Login, enquiries and uploads have stricter limits
// of their own on their routes.
app.use('/api', connectionLimiter);
app.use('/api', publicLimiter);
app.use('/api/admin', adminLimiter);

// Admin responses are never cached, and admin changes need the CSRF header
app.use('/api/admin', adminRequestGuard);

// Website changes are copied to the Google Sheet (when one is connected)
app.use('/api', sheetSyncTrigger);

// All /api routes live in src/routes
app.use('/api', apiRoutes);

// The website is hosted on Netlify, which proxies /api here, so on Render this
// is an API-only service. If frontend/dist has been built locally it is still
// served (handy for testing the production build on one port).
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (!fs.existsSync(frontendDist)) {
  app.get('/', (req, res) => {
    res.json({ name: 'Drive Kochi API', ok: true, health: '/api/health' });
  });
} else {
  app.use(express.static(frontendDist, { index: false }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Anything not matched above gets a 404, and errors get handled in one place
app.use(notFound);
app.use(errorHandler);

const port = env.port;
app.listen(port, () => {
  console.log(`Drive Kochi API listening on port ${port}`);
  startSheetSync();
});

module.exports = app;
