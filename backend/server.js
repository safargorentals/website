require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./src/config/env');
const apiRoutes = require('./src/routes');
const notFound = require('./src/middleware/notFound');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Render puts our app behind a proxy. Trust one hop so that
// rate limiting sees the real client IP instead of the proxy's.
app.set('trust proxy', 1);

// Basic security headers for every response. Car photos come from
// Cloudinary (or any https URL an admin pastes), so allow https images.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 'img-src': ["'self'", 'data:', 'https:'] },
    },
  })
);

// Only allow requests coming from your frontend
app.use(cors({ origin: env.frontendUrl, credentials: true }));

// Read request bodies sent as JSON (max 10 KB) and as cookies
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Limit how many API requests a client can make (100 per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// All /api routes live in src/routes
app.use('/api', apiRoutes);

// In production the built frontend (frontend/dist) is served from this same
// server, so the admin cookie stays same-origin. Any non-API page request
// gets index.html and React Router takes over.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
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
  console.log(`SafarGo API listening on port ${port}`);
});

module.exports = app;
