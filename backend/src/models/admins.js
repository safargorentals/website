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
    'SELECT id, email, password_hash FROM admins WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

// Find an admin by id (used to re-check a session against the database).
async function getAdminById(id) {
  const { rows } = await getPool().query('SELECT id, email FROM admins WHERE id = $1', [id]);
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

module.exports = { getAdminByEmail, getAdminById, createAdmin };
