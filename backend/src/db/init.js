const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// One-time helper: reads schema.sql and applies it to the database.
// Safe to run again - the schema uses IF NOT EXISTS.
async function main() {
  if (!pool) {
    console.error('ERROR: DATABASE_URL is not set.');
    console.error('Copy .env.example to .env and put your database URL in it, then run this again.');
    process.exitCode = 1;
    return;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('SUCCESS: database schema applied.');
    console.log('Tables ready: admins, cars, enquiries');
    console.log('Indexes ready: cars(is_featured), cars(type), enquiries(status), enquiries(created_at)');
  } catch (err) {
    console.error('ERROR: failed to apply the schema.');
    console.error('Details: ' + err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

main();
