const { Pool, types } = require('pg');
const env = require('./env');

// node-postgres turns Postgres DATE columns (OID 1082) into JavaScript Date
// objects at local midnight by default. Calling toISOString() on those
// converts to UTC, which shifts the day backwards in timezones ahead of UTC
// (e.g. Asia/Kolkata). Parse DATE as a plain 'YYYY-MM-DD' string instead,
// so date-only values are never timezone-shifted. This must run BEFORE the
// pool is created.
types.setTypeParser(1082, (value) => value);

// A pool keeps a few open database connections ready to use.
// It connects lazily (on the first query), so it is safe to
// create it even when no database is set up yet.
const pool = env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl })
  : null;

module.exports = pool;
