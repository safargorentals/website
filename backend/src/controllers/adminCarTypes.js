const { z } = require('zod');
const carTypesModel = require('../models/carTypes');
const { toCarTypeResponse } = require('./carTypes');

// Type photos: any https image link (uploads are Cloudinary links), or one
// of the stock photos bundled with the website (/images/*.webp).
const imageSchema = z
  .string()
  .trim()
  .max(2000, 'Image URL is too long')
  .regex(
    /^(https:\/\/\S+|\/images\/[a-z0-9-]+\.(webp|jpg|jpeg|png))$/,
    'Image must be an https:// link or a /images/... stock photo'
  );

const labelSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(30, 'Name must be at most 30 characters');

const blurbSchema = z.string().trim().max(80, 'Description must be at most 80 characters');

const createSchema = z
  .object({
    label: labelSchema,
    blurb: blurbSchema.optional(),
    image: imageSchema.nullable().optional(),
  })
  .strict();

// The slug (value) never changes once created: cars refer to it.
const updateSchema = z
  .object({
    label: labelSchema.optional(),
    blurb: blurbSchema.nullable().optional(),
    image: imageSchema.nullable().optional(),
  })
  .strict();

const slugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid type'),
});

const orderSchema = z
  .object({
    slugs: z.array(z.string()).min(1, 'slugs must list every type').max(100),
  })
  .strict();

// "Mini Van" -> "mini-van"
function slugify(label) {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

function sendValidationErrors(res, result) {
  const fields = {};
  for (const issue of result.error.issues) {
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

// Admin shape: the public fields plus order and how many cars use the type
function toAdminCarTypeResponse(t) {
  return { ...toCarTypeResponse(t), sortOrder: t.sort_order, carCount: t.car_count };
}

// Empty strings mean "no blurb"
const emptyToNull = (v) => (v === '' ? null : v);

// GET /api/admin/car-types
async function listAdminCarTypes(req, res, next) {
  try {
    const rows = await carTypesModel.getAllTypes();
    res.json({ data: rows.map(toAdminCarTypeResponse) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/car-types - body: { label, blurb?, image? }
async function createAdminCarType(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const { label, blurb, image } = parsed.data;
    const slug = slugify(label);
    if (!slug) {
      return res.status(400).json({ error: 'Validation failed', fields: { label: 'Name must contain letters or numbers' } });
    }
    const created = await carTypesModel.createType({ slug, label, blurb: emptyToNull(blurb), image });
    if (!created) {
      return res.status(409).json({ error: 'A car type with this name already exists', fields: { label: 'Already exists' } });
    }
    res.status(201).json(toAdminCarTypeResponse(created));
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/car-types/:slug - only provided fields change
async function updateAdminCarType(req, res, next) {
  try {
    const parsedSlug = slugSchema.safeParse(req.params);
    if (!parsedSlug.success) return sendValidationErrors(res, parsedSlug);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const data = { ...parsed.data };
    if (data.blurb !== undefined) data.blurb = emptyToNull(data.blurb);
    const updated = await carTypesModel.updateType(parsedSlug.data.slug, data);
    if (!updated) return res.status(404).json({ error: 'Car type not found' });
    res.json(toAdminCarTypeResponse(updated));
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/car-types/order - body: { slugs: ['suv', 'sedan', ...] }
// Must list every existing type exactly once.
async function reorderAdminCarTypes(req, res, next) {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const { slugs } = parsed.data;
    const existing = (await carTypesModel.getAllTypes()).map((t) => t.slug);
    const same =
      slugs.length === existing.length && new Set(slugs).size === slugs.length && slugs.every((s) => existing.includes(s));
    if (!same) {
      return res.status(400).json({ error: 'The new order must list every car type exactly once' });
    }
    await carTypesModel.reorderTypes(slugs);
    const rows = await carTypesModel.getAllTypes();
    res.json({ data: rows.map(toAdminCarTypeResponse) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/car-types/:slug - refused while any car uses the type
async function deleteAdminCarType(req, res, next) {
  try {
    const parsed = slugSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const result = await carTypesModel.deleteType(parsed.data.slug);
    if (result === 'not_found') return res.status(404).json({ error: 'Car type not found' });
    if (result === 'in_use') {
      return res.status(409).json({ error: 'Some cars still use this type. Move them to another type first.' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAdminCarTypes,
  createAdminCarType,
  updateAdminCarType,
  reorderAdminCarTypes,
  deleteAdminCarType,
  slugify,
};
