require('dotenv').config();

// All environment variables live here, so the rest of the app
// never reads process.env directly.
const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
};

if (!env.jwtSecret) {
  console.warn('JWT_SECRET is not set. Put it in your .env file.');
}
if (!env.databaseUrl) {
  console.warn('DATABASE_URL is not set. Database access is disabled.');
}

module.exports = env;
