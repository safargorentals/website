const carTypesModel = require('../models/carTypes');

// Public shape: the slug is called "value" because that is what the site
// filters cars by (GET /api/cars?type=<value>).
function toCarTypeResponse(t) {
  return { value: t.slug, label: t.label, blurb: t.blurb, image: t.image };
}

// GET /api/car-types
async function listCarTypes(req, res, next) {
  try {
    const rows = await carTypesModel.getAllTypes();
    res.json({ data: rows.map(toCarTypeResponse) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCarTypes, toCarTypeResponse };
