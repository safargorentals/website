const pool = require('../config/db');

// Security rule: every value goes into a query as a $n parameter.
// The only "dynamic" part of generated SQL is the column list,
// and column names are chosen from this fixed whitelist below -
// user input is never allowed to become part of the SQL text.
const WRITABLE_FIELDS = [
  'name',
  'brand',
  'type',
  'seats',
  'transmission',
  'fuel',
  'price_per_day',
  'currency',
  'images',
  'description',
  'is_featured',
  'featured_order',
  'is_available',
];

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function getPool() {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.');
  }
  return pool;
}

// List cars with optional filters and pagination.
// Filters: type, brand, transmission, fuel, is_available, search (matches name).
// Pagination: limit (rows per page) and offset (rows to skip).
// Returns { rows, count } where count is the total number of matching cars,
// ignoring pagination (the controller uses it to compute totalPages).
async function getAllCars(filters = {}) {
  const where = [];
  const params = [];

  const addEq = (column, value) => {
    params.push(value);
    where.push(`${column} = $${params.length}`);
  };

  if (filters.type) addEq('type', filters.type);
  if (filters.brand) addEq('brand', filters.brand);
  if (filters.transmission) addEq('transmission', filters.transmission);
  if (filters.fuel) addEq('fuel', filters.fuel);
  if (typeof filters.is_available === 'boolean') addEq('is_available', filters.is_available);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  // Keep limit/offset in a safe range even if the caller passes odd values
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(filters.limit) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const { rows } = await getPool().query(
    `SELECT * FROM cars${whereSql} ORDER BY is_featured DESC, name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM cars${whereSql}`,
    params
  );

  return { rows, count: countRows[0].count };
}

// Every car, oldest first (for the Google Sheet)
async function getAllCarsUnpaged() {
  const { rows } = await getPool().query('SELECT * FROM cars ORDER BY id ASC');
  return rows;
}

// Cars for the home page "featured" section
async function getFeaturedCars() {
  const { rows } = await getPool().query(
    'SELECT * FROM cars WHERE is_featured = TRUE ORDER BY featured_order ASC, name ASC'
  );
  return rows;
}

// One car, or null if the id does not exist
async function getCarById(id) {
  const { rows } = await getPool().query('SELECT * FROM cars WHERE id = $1', [id]);
  return rows[0] || null;
}

// Insert a new car. "data" should only contain keys from WRITABLE_FIELDS.
async function createCar(data) {
  const fields = WRITABLE_FIELDS.filter((f) => data[f] !== undefined);
  if (fields.length === 0) {
    throw new Error('createCar: no valid fields to insert');
  }
  const params = fields.map((f) => data[f]);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO cars (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await getPool().query(sql, params);
  return rows[0];
}

// Change only the fields provided in "data"
async function updateCar(id, data) {
  const fields = WRITABLE_FIELDS.filter((f) => data[f] !== undefined);
  if (fields.length === 0) return getCarById(id);

  const setClauses = [];
  const params = [];
  fields.forEach((f) => {
    params.push(data[f]);
    setClauses.push(`${f} = $${params.length}`);
  });
  params.push(id);

  const sql = `UPDATE cars SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`;
  const { rows } = await getPool().query(sql, params);
  return rows[0] || null;
}

// Quick price change (the database also rejects negative prices)
async function updatePrice(id, price) {
  const { rows } = await getPool().query(
    'UPDATE cars SET price_per_day = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [price, id]
  );
  return rows[0] || null;
}

// Add a car to the featured list, or remove it
async function setFeatured(id, isFeatured, order = null) {
  const { rows } = await getPool().query(
    'UPDATE cars SET is_featured = $1, featured_order = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [isFeatured, order, id]
  );
  return rows[0] || null;
}

// Delete a car. Its enquiries stay, with car_id set to NULL.
// Returns true if a row was deleted, false if the id did not exist.
async function deleteCar(id) {
  const { rowCount } = await getPool().query('DELETE FROM cars WHERE id = $1', [id]);
  return rowCount > 0;
}

// Counts for the admin dashboard: total cars, how many are available and
// how many are featured. No user input is involved, so there is nothing
// to parameterize.
async function getCarStats() {
  const { rows } = await getPool().query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE is_available = TRUE)::int AS available,
       COUNT(*) FILTER (WHERE is_featured = TRUE)::int AS featured
     FROM cars`
  );
  const row = rows[0];
  return { total: row.total, available: row.available, featured: row.featured };
}

module.exports = {
  getAllCars,
  getAllCarsUnpaged,
  getFeaturedCars,
  getCarById,
  createCar,
  updateCar,
  updatePrice,
  setFeatured,
  deleteCar,
  getCarStats,
};
