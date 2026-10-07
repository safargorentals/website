require('dotenv').config();

// All environment variables live here, so the rest of the app
// never reads process.env directly.
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// The placeholder used in .env.example. If a real deployment still uses it,
// the secret is not a secret at all.
const PLACEHOLDER_SECRET = 'change-me-to-a-long-random-string';

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  // The frontend origin(s). FRONTEND_URL may hold one or several origins
  // separated by commas, e.g. "http://localhost:5173,https://safargo.com".
  // Only these exact origins ever get CORS headers - never "*".
  frontendUrl: process.env.FRONTEND_URL,
  frontendOrigins: (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // How many proxies sit in front of the app. 1 = Render only; 2 when the
  // frontend host (e.g. Netlify) also proxies /api to us.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS) || 1,
  // Cloudinary image uploads (admin only). Read from the environment,
  // never hardcoded anywhere.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  // New-enquiry email alerts (via Resend). Read from the environment,
  // never hardcoded anywhere.
  resendApiKey: process.env.RESEND_API_KEY,
  notifyEmailTo: process.env.NOTIFY_EMAIL_TO,
  notifyEmailFrom: process.env.NOTIFY_EMAIL_FROM,
  // Base URL of the admin panel, used to link new enquiries in the email
  adminUrl: process.env.ADMIN_URL,
  // Shared secret for Netlify "signed proxy redirects". When set, every API
  // request must carry Netlify's x-nf-sign header signed with it, so the
  // Render URL cannot be called directly (bypassing Netlify and faking
  // client IPs). Must equal the site's API_SIGNATURE_TOKEN on Netlify.
  netlifyProxySecret: process.env.NETLIFY_PROXY_SECRET,
  // Google Sheet that mirrors cars, locations and enquiries both ways (see
  // src/services/sheetSync.js). Both empty = the sync is off.
  googleSheetId: process.env.GOOGLE_SHEET_ID,
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
};

// Admin JWTs are always HMAC-SHA256; verification accepts nothing else.
env.jwtAlgorithm = 'HS256';

// Admin session cookie settings, driven by the environment so they can be
// adjusted at deployment time.
// COOKIE_SECURE defaults to true in production (HTTPS) and false otherwise.
env.cookieSecure =
  process.env.COOKIE_SECURE === undefined
    ? isProduction
    : process.env.COOKIE_SECURE === 'true';
// strict (default) or lax
env.cookieSameSite = process.env.COOKIE_SAME_SITE || 'strict';

// The admin session lasts 8 hours (JWT expiry and cookie age match).
env.tokenTtlSeconds = 8 * 60 * 60;
env.cookieOptions = {
  name: 'admin_token',
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  // No maxAge: a browser-session cookie, gone when the browser is closed.
  // The JWT inside still expires after tokenTtlSeconds (8 hours).
  path: '/',
};

// A readable companion cookie that only says "an admin is logged in on this
// browser". It grants nothing (the API never reads it); the website uses it
// to send a logged-in admin straight to the dashboard without asking the
// API on every public page view. Set and cleared together with the session.
env.hintCookieOptions = { ...env.cookieOptions, name: 'admin_hint', httpOnly: false };

// In production a missing or weak JWT_SECRET would let anyone forge admin
// tokens, so refuse to start instead of running with a guessable secret.
if (
  isProduction &&
  (!env.jwtSecret ||
    env.jwtSecret.length < 32 ||
    env.jwtSecret === PLACEHOLDER_SECRET)
) {
  console.error(
    'FATAL: JWT_SECRET must be set in production, must be at least 32 characters, and must not be the placeholder from .env.example.'
  );
  process.exit(1);
}

if (!env.jwtSecret) {
  console.warn('JWT_SECRET is not set. Put it in your .env file.');
}
if (!env.databaseUrl) {
  console.warn('DATABASE_URL is not set. Database access is disabled.');
}

module.exports = env;
