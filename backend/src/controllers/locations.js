const locationsModel = require('../models/locations');

function toLocationResponse(l) {
  return { id: l.id, name: l.name, tag: l.tag };
}

// GET /api/locations
async function listLocations(req, res, next) {
  try {
    const rows = await locationsModel.getAllLocations();
    res.json({ data: rows.map(toLocationResponse) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLocations, toLocationResponse };
