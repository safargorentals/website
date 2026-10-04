const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// One-off move of all data from one Postgres database to another, e.g. from
// Render's free database (expires after 30 days) to Neon's free database.
//
//   OLD_DATABASE_URL = where the data is now  (read only)
//   DATABASE_URL     = the new, empty database
//
//   npm run db:copy
//
// It creates the tables on the new database (schema.sql), refuses to run if
// they already hold data, copies every row in one transaction with the same
// ids, moves the id counters on, and checks the row counts match.

// Parents before children, so foreign keys are satisfied
const TABLES = ['admins', 'car_types', 'cars', 'enquiries'];

const describe = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`; // never print the password
  } catch {
    return '(invalid URL)';
  }
};

async function main() {
  const fromUrl = process.env.OLD_DATABASE_URL;
  const toUrl = process.env.DATABASE_URL;
  if (!fromUrl || !toUrl) {
    console.error('ERROR: set OLD_DATABASE_URL (current database) and DATABASE_URL (new database) in .env first.');
    process.exitCode = 1;
    return;
  }
  if (fromUrl === toUrl) {
    console.error('ERROR: OLD_DATABASE_URL and DATABASE_URL are the same database.');
    process.exitCode = 1;
    return;
  }

  console.log(`From: ${describe(fromUrl)}`);
  console.log(`To:   ${describe(toUrl)}`);

  const from = new Pool({ connectionString: fromUrl, max: 1 });
  const to = new Pool({ connectionString: toUrl, max: 1, connectionTimeoutMillis: 20000 });
  const client = await to.connect();

  try {
    // 1. Tables on the new database
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // 2. Refuse to overwrite real data. car_types always holds the six
    //    default rows that schema.sql inserts; those are replaced below.
    for (const table of TABLES.filter((t) => t !== 'car_types')) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      if (rows[0].n > 0) {
        throw new Error(`the new database already has ${rows[0].n} rows in "${table}". Nothing was copied.`);
      }
    }

    // 3. Copy everything in one transaction: all or nothing
    await client.query('BEGIN');
    await client.query('DELETE FROM car_types');
    const counts = {};
    for (const table of TABLES) {
      const { rows } = await from.query(`SELECT * FROM ${table}`);
      const targetCols = new Set(
        (
          await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
            [table]
          )
        ).rows.map((r) => r.column_name)
      );
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => targetCols.has(c));
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map((c) => row[c])
        );
      }
      counts[table] = rows.length;
    }

    // 4. Continue the id counters after the copied ids
    for (const table of ['admins', 'cars', 'enquiries']) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
        [table]
      );
    }
    await client.query('COMMIT');

    // 5. Check
    let ok = true;
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      const match = rows[0].n === counts[table];
      ok = ok && match;
      console.log(`${match ? 'OK ' : 'MISMATCH'} ${table.padEnd(10)} ${counts[table]} copied, ${rows[0].n} in new database`);
    }
    console.log(ok ? 'SUCCESS: all data copied.' : 'ERROR: row counts differ, check above.');
    if (!ok) process.exitCode = 1;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR: ' + err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await from.end();
    await to.end();
  }
}

main();
