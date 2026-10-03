require('dotenv').config();

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

// Basic security headers for every response
app.use(helmet());

// Only allow requests coming from your frontend
app.use(cors({ origin: env.frontendUrl, credentials: true }));

// Read request bodies sent as JSON and as cookies
app.use(express.json());
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

// Anything not matched above gets a 404, and errors get handled in one place
app.use(notFound);
app.use(errorHandler);

const port = env.port;
app.listen(port, () => {
  console.log(`SafarGo API listening on port ${port}`);
});

module.exports = app;
