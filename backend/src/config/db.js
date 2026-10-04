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
//
// Tuned for serverless Postgres such as Neon, which sleeps when idle and
// closes idle connections:
// - idle connections are closed by us after 30 s, before the server drops them
// - the first query after a sleep may take a moment, so allow 15 s to connect
const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30 * 1000,
      connectionTimeoutMillis: 15 * 1000,
    })
  : null;

// When the database closes an idle connection, pg emits 'error' on the
// pool. Without a listener that would crash the whole server; the pool
// simply opens a fresh connection on the next query.
if (pool) {
  pool.on('error', (err) => {
    console.error('Database connection closed unexpectedly:', err.message);
  });
}

module.exports = pool;
