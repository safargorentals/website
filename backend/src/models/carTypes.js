const pool = require('../config/db');

// Car types (SUV, sedan, ...). Every value goes into queries as a $n
// parameter; column names are fixed in the SQL text.

function getPool() {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.');
  }
  return pool;
}

// All types in display order, each with how many cars use it
async function getAllTypes() {
  const { rows } = await getPool().query(
    `SELECT t.*, COUNT(c.id)::int AS car_count
     FROM car_types t
     LEFT JOIN cars c ON c.type = t.slug
     GROUP BY t.slug
     ORDER BY t.sort_order ASC, t.label ASC`
  );
  return rows;
}

// One type (with its car count), or null
async function getTypeBySlug(slug) {
  const { rows } = await getPool().query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM cars c WHERE c.type = t.slug) AS car_count
     FROM car_types t WHERE t.slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

async function typeExists(slug) {
  const { rowCount } = await getPool().query('SELECT 1 FROM car_types WHERE slug = $1', [slug]);
  return rowCount > 0;
}

// New types go to the end of the list. Returns null if the slug is taken.
async function createType({ slug, label, blurb, image }) {
  const { rows } = await getPool().query(
    `INSERT INTO car_types (slug, label, blurb, image, sort_order)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM car_types))
     ON CONFLICT (slug) DO NOTHING
     RETURNING *, 0 AS car_count`,
    [slug, label, blurb ?? null, image ?? null]
  );
  return rows[0] || null;
}

// Change label/blurb/image. Only keys present in "data" change;
// null clears blurb or image.
async function updateType(slug, data) {
  const columns = ['label', 'blurb', 'image'].filter((c) => data[c] !== undefined);
  if (columns.length === 0) return getTypeBySlug(slug);
  const params = columns.map((c) => data[c]);
  const sets = columns.map((c, i) => `${c} = $${i + 1}`);
  params.push(slug);
  const { rowCount } = await getPool().query(
    `UPDATE car_types SET ${sets.join(', ')}, updated_at = NOW() WHERE slug = $${params.length}`,
    params
  );
  return rowCount ? getTypeBySlug(slug) : null;
}

// Set the display order from a list of slugs (first = 1). Runs in one
// transaction so a half-applied order is never visible.
async function reorderTypes(slugs) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < slugs.length; i++) {
      await client.query('UPDATE car_types SET sort_order = $1, updated_at = NOW() WHERE slug = $2', [
        i + 1,
        slugs[i],
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Delete a type only if no car uses it, checked in the same statement so a
// car saved in between cannot be left with a missing type.
// Returns 'deleted', 'in_use' or 'not_found'.
async function deleteType(slug) {
  const { rowCount } = await getPool().query(
    `DELETE FROM car_types t
     WHERE t.slug = $1 AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.type = t.slug)`,
    [slug]
  );
  if (rowCount > 0) return 'deleted';
  return (await typeExists(slug)) ? 'in_use' : 'not_found';
}

module.exports = {
  getAllTypes,
  getTypeBySlug,
  typeExists,
  createType,
  updateType,
  reorderTypes,
  deleteType,
};
