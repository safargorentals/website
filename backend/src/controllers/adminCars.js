const { z } = require('zod');
const carsModel = require('../models/cars');
const carTypesModel = require('../models/carTypes');

const TRANSMISSIONS = ['manual', 'automatic'];
const FUELS = ['petrol', 'diesel', 'hybrid', 'electric', 'cng'];

const priceSchema = z
  .number()
  .min(0, 'pricePerDay must be at least 0')
  .max(1000000, 'pricePerDay must be at most 1000000');

// Full validation for creating a car. Extra keys are ignored here
// (the model only writes whitelisted columns), but PUT uses strict mode.
const adminCarSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  brand: z
    .string()
    .trim()
    .min(2, 'Brand must be at least 2 characters')
    .max(50, 'Brand must be at most 50 characters'),
  // Checked against the car_types table after parsing (see checkCarType)
  type: z.string().trim().min(1, 'Choose a car type'),
  seats: z
    .number()
    .int()
    .min(1, 'Seats must be at least 1')
    .max(20, 'Seats must be at most 20'),
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUELS),
  pricePerDay: priceSchema,
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency must be 3 uppercase letters')
    .default('INR'),
  images: z
    .array(
      // Uploaded photos are Cloudinary links, but any https image link is
      // accepted so pasted links (and older cars' images) can be saved.
      z
        .string()
        .trim()
        .max(2000, 'Image URL is too long')
        .regex(/^https:\/\/\S+$/, 'Image URLs must start with https://')
    )
    .max(10, 'At most 10 images are allowed')
    .default([]),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  isAvailable: z.boolean().default(true),
});

// Partial update: same rules for provided fields, unknown fields rejected
const adminCarUpdateSchema = adminCarSchema.partial().strict();

const priceBodySchema = z.object({ pricePerDay: priceSchema }).strict();

const featuredBodySchema = z
  .object({
    isFeatured: z.boolean(),
    featuredOrder: z.number().int().min(1, 'featuredOrder must be at least 1').max(100, 'featuredOrder must be at most 100').optional(),
  })
  .strict();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const carIdSchema = z.object({
  id: z.coerce.number().int().min(1),
});

// API (camelCase) -> database (snake_case)
const FIELD_MAP = {
  name: 'name',
  brand: 'brand',
  type: 'type',
  seats: 'seats',
  transmission: 'transmission',
  fuel: 'fuel',
  pricePerDay: 'price_per_day',
  currency: 'currency',
  images: 'images',
  description: 'description',
  isAvailable: 'is_available',
};

// The admin shape: everything public plus the internal fields
function toAdminCarResponse(car) {
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
    featuredOrder: car.featured_order,
    createdAt: car.created_at,
    updatedAt: car.updated_at,
  };
}

function sendValidationErrors(res, result) {
  const fields = {};
  for (const issue of result.error.issues) {
    // .strict() reports ALL unknown keys in one issue with an empty path,
    // so spread them out: { id: "...", bogus: "..." }
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      for (const key of issue.keys) {
        if (!fields[key]) fields[key] = issue.message;
      }
      continue;
    }
    const key = String(issue.path[0]);
    if (!fields[key]) fields[key] = issue.message;
  }
  res.status(400).json({ error: 'Validation failed', fields });
}

// The type must be one of the types managed in the admin panel.
// Sends a 400 and returns false if it is not.
async function checkCarType(res, type) {
  if (type === undefined || (await carTypesModel.typeExists(type))) return true;
  res.status(400).json({ error: 'Validation failed', fields: { type: 'Unknown car type' } });
  return false;
}

function toModelPayload(data) {
  const payload = {};
  for (const [from, to] of Object.entries(FIELD_MAP)) {
    if (data[from] !== undefined) payload[to] = data[from];
  }
  return payload;
}

// GET /api/admin/cars?page=1&limit=20
// No filters: admins see every car, available or not
async function listAdminCars(req, res, next) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const q = parsed.data;
    const offset = (q.page - 1) * q.limit;

    const { rows, count } = await carsModel.getAllCars({ limit: q.limit, offset });
    const totalPages = Math.max(1, Math.ceil(count / q.limit));
    res.json({ data: rows.map(toAdminCarResponse), page: q.page, totalPages });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/cars/:id
async function getAdminCar(req, res, next) {
  try {
    const parsed = carIdSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const car = await carsModel.getCarById(parsed.data.id);
    if (!car) return res.status(404).json({ error: 'Car not found' });
    res.json(toAdminCarResponse(car));
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/cars
async function createAdminCar(req, res, next) {
  try {
    const parsed = adminCarSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    if (!(await checkCarType(res, parsed.data.type))) return;
    const created = await carsModel.createCar(toModelPayload(parsed.data));
    res.status(201).json(toAdminCarResponse(created));
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/cars/:id - only provided fields change
async function updateAdminCar(req, res, next) {
  try {
    const parsedId = carIdSchema.safeParse(req.params);
    if (!parsedId.success) return sendValidationErrors(res, parsedId);
    const parsed = adminCarUpdateSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    if (!(await checkCarType(res, parsed.data.type))) return;
    const updated = await carsModel.updateCar(parsedId.data.id, toModelPayload(parsed.data));
    if (!updated) return res.status(404).json({ error: 'Car not found' });
    res.json(toAdminCarResponse(updated));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/cars/:id/price - body: { pricePerDay: 9500 }
async function updateAdminCarPrice(req, res, next) {
  try {
    const parsedId = carIdSchema.safeParse(req.params);
    if (!parsedId.success) return sendValidationErrors(res, parsedId);
    const parsed = priceBodySchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const updated = await carsModel.updatePrice(parsedId.data.id, parsed.data.pricePerDay);
    if (!updated) return res.status(404).json({ error: 'Car not found' });
    res.json(toAdminCarResponse(updated));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/cars/:id/featured - body: { isFeatured, featuredOrder? }
async function setAdminCarFeatured(req, res, next) {
  try {
    const parsedId = carIdSchema.safeParse(req.params);
    if (!parsedId.success) return sendValidationErrors(res, parsedId);
    const parsed = featuredBodySchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const isFeatured = parsed.data.isFeatured;
    // Turning a car unfeatured always clears its featured position
    const order = isFeatured ? (parsed.data.featuredOrder ?? null) : null;
    const updated = await carsModel.setFeatured(parsedId.data.id, isFeatured, order);
    if (!updated) return res.status(404).json({ error: 'Car not found' });
    res.json(toAdminCarResponse(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/cars/:id
// Linked enquiries stay in the database (their car_id becomes NULL there)
async function deleteAdminCar(req, res, next) {
  try {
    const parsed = carIdSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const deleted = await carsModel.deleteCar(parsed.data.id);
    if (!deleted) return res.status(404).json({ error: 'Car not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminCarSchema,
  TRANSMISSIONS,
  FUELS,
  listAdminCars,
  getAdminCar,
  createAdminCar,
  updateAdminCar,
  updateAdminCarPrice,
  setAdminCarFeatured,
  deleteAdminCar,
};
