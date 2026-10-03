const { Pool } = require('pg');
const env = require('./env');

// A pool keeps a few open database connections ready to use.
// It connects lazily (on the first query), so it is safe to
// create it even when no database is set up yet.
const pool = env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl })
  : null;

module.exports = pool;
