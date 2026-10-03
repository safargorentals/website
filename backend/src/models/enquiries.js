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

module.exports = { createEnquiry };
