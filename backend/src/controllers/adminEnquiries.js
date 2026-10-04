const { z } = require('zod');
const enquiriesModel = require('../models/enquiries');

const ENQUIRY_STATUSES = ['new', 'contacted', 'confirmed', 'closed'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-13-01" matches the YYYY-MM-DD pattern but is not a real date
function isRealDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const listQuerySchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  carId: z.coerce.number().int().min(1).optional(),
  from: z
    .string()
    .max(100)
    .regex(DATE_RE, 'from must be in YYYY-MM-DD format')
    .refine(isRealDate, 'from must be a real calendar date')
    .optional(),
  to: z
    .string()
    .max(100)
    .regex(DATE_RE, 'to must be in YYYY-MM-DD format')
    .refine(isRealDate, 'to must be a real calendar date')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const enquiryIdSchema = z.object({
  id: z.coerce.number().int().min(1),
});

// Only status and notes may change here. .strict() rejects everything else
// (customer details like name or phone can never be edited from this route).
const patchBodySchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    notes: z.string().trim().max(2000, 'Notes must be at most 2000 characters').optional(),
  })
  .strict();

// DATE columns arrive as plain 'YYYY-MM-DD' strings (see src/config/db.js),
// so pass them through untouched. Never call toISOString() on date-only
// values: it converts to UTC and shifts the day in timezones ahead of UTC
// (full timestamps like createdAt below are instants, so ISO is correct there).
function formatDateOnly(value) {
  if (value == null) return null;
  return String(value).slice(0, 10);
}

// Times come back as 'HH:MM:SS' strings - cut to 'HH:MM'.
function formatTimeOnly(value) {
  if (value == null) return null;
  return String(value).slice(0, 5);
}

// camelCase for the API. carName is null when the car was deleted.
function toEnquiryResponse(e) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    email: e.email,
    carId: e.car_id,
    carName: e.car_name,
    pickupLocation: e.pickup_location,
    dropoffLocation: e.dropoff_location,
    startDate: formatDateOnly(e.start_date),
    endDate: formatDateOnly(e.end_date),
    pickupTime: formatTimeOnly(e.pickup_time),
    dropoffTime: formatTimeOnly(e.dropoff_time),
    message: e.message,
    status: e.status,
    notes: e.notes,
    createdAt: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
  };
}

function sendValidationErrors(res, result) {
  const fields = {};
  for (const issue of result.error.issues) {
    // .strict() reports ALL unknown keys in one issue with an empty path,
    // so spread them out: { name: "..." }
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

// GET /api/admin/enquiries?status=...&search=...&carId=...&from=...&to=...&page=1&limit=20
async function listEnquiries(req, res, next) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const q = parsed.data;
    const offset = (q.page - 1) * q.limit;

    const { rows, count } = await enquiriesModel.getEnquiries({
      status: q.status,
      search: q.search,
      carId: q.carId,
      from: q.from,
      to: q.to,
      limit: q.limit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(count / q.limit));
    res.json({ data: rows.map(toEnquiryResponse), page: q.page, totalPages, total: count });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/enquiries/:id
async function getEnquiry(req, res, next) {
  try {
    const parsed = enquiryIdSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const enquiry = await enquiriesModel.getEnquiryById(parsed.data.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    res.json(toEnquiryResponse(enquiry));
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/enquiries/stats - counts per status plus a total
async function getEnquiryStats(req, res, next) {
  try {
    res.json(await enquiriesModel.getEnquiryStats());
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/enquiries/:id - body: { status?, notes? } and nothing else
async function updateEnquiry(req, res, next) {
  try {
    const parsedId = enquiryIdSchema.safeParse(req.params);
    if (!parsedId.success) return sendValidationErrors(res, parsedId);
    const parsed = patchBodySchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const updated = await enquiriesModel.updateEnquiry(parsedId.data.id, {
      status: parsed.data.status,
      notes: parsed.data.notes,
    });
    if (!updated) return res.status(404).json({ error: 'Enquiry not found' });
    res.json(toEnquiryResponse(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/enquiries/:id
async function deleteEnquiry(req, res, next) {
  try {
    const parsed = enquiryIdSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const deleted = await enquiriesModel.deleteEnquiry(parsed.data.id);
    if (!deleted) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEnquiries,
  getEnquiry,
  getEnquiryStats,
  updateEnquiry,
  deleteEnquiry,
};
