const pool = require('../config/db');

function getPool() {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.');
  }
  return pool;
}

// Find an admin by email (including the hash, used only by login).
async function getAdminByEmail(email) {
  const { rows } = await getPool().query(
    'SELECT id, email, password_hash, token_version FROM admins WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

// Find an admin by id (used to re-check a session against the database).
async function getAdminById(id) {
  const { rows } = await getPool().query(
    'SELECT id, email, token_version FROM admins WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

// Insert a new admin with an already-hashed password.
async function createAdmin(email, passwordHash) {
  const { rows } = await getPool().query(
    'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, passwordHash]
  );
  return rows[0];
}

// Replace an admin's password hash and end all of that admin's sessions.
// Returns true when a row was updated.
async function updateAdminPassword(id, passwordHash) {
  const { rowCount } = await getPool().query(
    'UPDATE admins SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
    [passwordHash, id]
  );
  return rowCount > 0;
}

// End every session of this admin (all browsers): tokens carrying the old
// version are rejected by requireAdmin from now on.
async function bumpTokenVersion(id) {
  await getPool().query('UPDATE admins SET token_version = token_version + 1 WHERE id = $1', [id]);
}

module.exports = { getAdminByEmail, getAdminById, createAdmin, updateAdminPassword, bumpTokenVersion };
