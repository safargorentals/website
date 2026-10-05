const pool = require('../config/db');

// Pickup / drop-off locations. Every value goes into queries as a $n
// parameter; column names are fixed in the SQL text.

function getPool() {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.');
  }
  return pool;
}

const UNIQUE_VIOLATION = '23505';

// All locations in display order
async function getAllLocations() {
  const { rows } = await getPool().query('SELECT * FROM locations ORDER BY sort_order ASC, name ASC');
  return rows;
}

// New locations go to the end of the list. Returns null if the name is
// already used (names are unique, ignoring upper/lower case).
async function createLocation({ name, tag }) {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO locations (name, tag, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM locations))
       RETURNING *`,
      [name, tag ?? null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return null;
    throw err;
  }
}

// Change name and/or tag. Returns the row, null if the id does not exist,
// or 'duplicate' if the new name is already used.
async function updateLocation(id, data) {
  const columns = ['name', 'tag'].filter((c) => data[c] !== undefined);
  if (columns.length === 0) {
    const { rows } = await getPool().query('SELECT * FROM locations WHERE id = $1', [id]);
    return rows[0] || null;
  }
  const params = columns.map((c) => data[c]);
  const sets = columns.map((c, i) => `${c} = $${i + 1}`);
  params.push(id);
  try {
    const { rows } = await getPool().query(
      `UPDATE locations SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return 'duplicate';
    throw err;
  }
}

// Set the display order from a list of ids (first = 1), in one transaction
async function reorderLocations(ids) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE locations SET sort_order = $1, updated_at = NOW() WHERE id = $2', [i + 1, ids[i]]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Returns true if a row was deleted. Past enquiries keep the name as text.
async function deleteLocation(id) {
  const { rowCount } = await getPool().query('DELETE FROM locations WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { getAllLocations, createLocation, updateLocation, reorderLocations, deleteLocation };
