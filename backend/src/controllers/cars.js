const { z } = require('zod');
const carsModel = require('../models/cars');

// What GET /api/cars is allowed to receive. Query params arrive as strings,
// so page/limit are coerced to numbers first.
// Every search/filter string is capped at 100 chars to bound DB LIKE work.
const listQuerySchema = z.object({
  type: z.string().min(1).max(100).optional(),
  brand: z.string().min(1).max(100).optional(),
  transmission: z.string().min(1).max(100).optional(),
  fuel: z.string().min(1).max(100).optional(),
  search: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// What GET /api/cars/:id is allowed to receive
const carIdSchema = z.object({
  id: z.coerce.number().int().min(1),
});

// Pick only the public fields of a car, in camelCase.
// pricePerDay must be a number, so convert it (pg returns NUMERIC as a string).
// created_at, updated_at and featured_order are deliberately left out.
function toCarResponse(car) {
  return {
    id: car.id,
    name: car.name,
    brand: car.brand,
    type: car.type,
    seats: car.seats,
    transmission: car.transmission,
    fuel: car.fuel,
    pricePerDay: Number(car.price_per_day),
    currency: car.currency,
    images: car.images || [],
    description: car.description,
    isFeatured: car.is_featured,
    isAvailable: car.is_available,
  };
}

// 400 response that lists which fields were invalid
function sendValidationErrors(res, result, message) {
  const fields = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    if (!fields[key]) fields[key] = issue.message;
  }
  res.status(400).json({ error: message, fields });
}

// GET /api/cars?type=...&brand=...&transmission=...&fuel=...&search=...&page=1&limit=12
async function listCars(req, res, next) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendValidationErrors(res, parsed, 'Invalid query parameters');
    }
    const q = parsed.data;
    const offset = (q.page - 1) * q.limit;

    const { rows, count } = await carsModel.getAllCars({
      type: q.type,
      brand: q.brand,
      transmission: q.transmission,
      fuel: q.fuel,
      search: q.search,
      limit: q.limit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(count / q.limit));
    res.json({ data: rows.map(toCarResponse), page: q.page, totalPages });
  } catch (err) {
    next(err);
  }
}

// GET /api/cars/featured
async function listFeaturedCars(req, res, next) {
  try {
    const rows = await carsModel.getFeaturedCars();
    res.json({ data: rows.map(toCarResponse) });
  } catch (err) {
    next(err);
  }
}

// GET /api/cars/:id
async function getCar(req, res, next) {
  try {
    const parsed = carIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendValidationErrors(res, parsed, 'Invalid car id');
    }
    const car = await carsModel.getCarById(parsed.data.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json(toCarResponse(car));
  } catch (err) {
    next(err);
  }
}

module.exports = { listCars, listFeaturedCars, getCar };
