const pool = require('../config/db');

function getPool() {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.');
  }
  return pool;
}

// Insert one enquiry. All user values go in as $n parameters -
// nothing from the request is ever part of the SQL text.
// status is left to the database default ('new').
async function createEnquiry(data) {
  const sql = `
    INSERT INTO enquiries
      (name, phone, email, car_id,
       pickup_location, dropoff_location,
       start_date, end_date, pickup_time, dropoff_time,
       message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `;
  const params = [
    data.name,
    data.phone,
    data.email ?? null,
    data.carId ?? null,
    data.pickupLocation,
    data.dropoffLocation,
    data.startDate,
    data.endDate,
    data.pickupTime,
    data.dropoffTime,
    data.message ?? null,
  ];
  const { rows } = await getPool().query(sql, params);
  return rows[0];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// List enquiries, newest first, with optional filters.
// Filters: status, search (name/phone/email), carId, from/to (created-date
// YYYY-MM-DD, both ends inclusive), limit, offset.
// Returns { rows, count }; each row carries car_name (null if the car
// was deleted). Values go in as $n parameters, wildcards included.
async function getEnquiries(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`e.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    where.push(`(e.name ILIKE ${p} OR e.phone ILIKE ${p} OR e.email ILIKE ${p})`);
  }
  if (filters.carId != null) {
    params.push(filters.carId);
    where.push(`e.car_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`e.created_at >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`e.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  // Keep limit/offset in a safe range even if the caller passes odd values
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(filters.limit) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const { rows } = await getPool().query(
    `SELECT e.*, c.name AS car_name FROM enquiries e LEFT JOIN cars c ON c.id = e.car_id${whereSql} ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM enquiries e${whereSql}`,
    params
  );

  return { rows, count: countRows[0].count };
}

// Every enquiry with its car name, newest first (for the Google Sheet)
async function getAllEnquiriesUnpaged() {
  const { rows } = await getPool().query(
    'SELECT e.*, c.name AS car_name FROM enquiries e LEFT JOIN cars c ON c.id = e.car_id ORDER BY e.created_at DESC, e.id DESC'
  );
  return rows;
}

// One enquiry with its car name, or null if the id does not exist
async function getEnquiryById(id) {
  const { rows } = await getPool().query(
    'SELECT e.*, c.name AS car_name FROM enquiries e LEFT JOIN cars c ON c.id = e.car_id WHERE e.id = $1',
    [id]
  );
  return rows[0] || null;
}

// Change only status and/or notes (the only fields an admin may touch).
// Any other key in "data" is ignored here; the controller rejects it first.
async function updateEnquiry(id, data) {
  const sets = [];
  const params = [];
  if (data.status !== undefined) {
    params.push(data.status);
    sets.push(`status = $${params.length}`);
  }
  if (data.notes !== undefined) {
    params.push(data.notes);
    sets.push(`notes = $${params.length}`);
  }
  if (sets.length === 0) return getEnquiryById(id);

  params.push(id);
  await getPool().query(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return getEnquiryById(id);
}

// Delete one enquiry.
// Returns true if a row was deleted, false if the id did not exist.
async function deleteEnquiry(id) {
  const { rowCount } = await getPool().query('DELETE FROM enquiries WHERE id = $1', [id]);
  return rowCount > 0;
}

// Counts per status plus a total, for the dashboard.
// No user input is involved, so there is nothing to parameterize.
async function getEnquiryStats() {
  const { rows } = await getPool().query(
    'SELECT status, COUNT(*)::int AS count FROM enquiries GROUP BY status'
  );
  const stats = { new: 0, contacted: 0, confirmed: 0, closed: 0, total: 0 };
  for (const row of rows) {
    if (Object.hasOwn(stats, row.status)) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }
  }
  return stats;
}

module.exports = {
  createEnquiry,
  getEnquiries,
  getAllEnquiriesUnpaged,
  getEnquiryById,
  updateEnquiry,
  deleteEnquiry,
  getEnquiryStats,
};
