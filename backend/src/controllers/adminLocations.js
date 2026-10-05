const { z } = require('zod');
const locationsModel = require('../models/locations');
const { toLocationResponse } = require('./locations');

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name must be at most 60 characters');

// Short label shown in brackets, e.g. "pickup" or "yard"
const tagSchema = z.string().trim().max(20, 'Label must be at most 20 characters');

const createSchema = z.object({ name: nameSchema, tag: tagSchema.optional() }).strict();
const updateSchema = z.object({ name: nameSchema.optional(), tag: tagSchema.nullable().optional() }).strict();
const idSchema = z.object({ id: z.coerce.number().int().min(1) });
const orderSchema = z.object({ ids: z.array(z.number().int().min(1)).min(1).max(200) }).strict();

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

// Empty label means "no label"
const emptyToNull = (v) => (v === '' ? null : v);

const duplicate = (res) =>
  res.status(409).json({ error: 'A location with this name already exists', fields: { name: 'Already exists' } });

// GET /api/admin/locations
async function listAdminLocations(req, res, next) {
  try {
    const rows = await locationsModel.getAllLocations();
    res.json({ data: rows.map(toLocationResponse) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/locations - body: { name, tag? }
async function createAdminLocation(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const created = await locationsModel.createLocation({
      name: parsed.data.name,
      tag: emptyToNull(parsed.data.tag),
    });
    if (!created) return duplicate(res);
    res.status(201).json(toLocationResponse(created));
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/locations/:id - only provided fields change
async function updateAdminLocation(req, res, next) {
  try {
    const parsedId = idSchema.safeParse(req.params);
    if (!parsedId.success) return sendValidationErrors(res, parsedId);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const data = { ...parsed.data };
    if (data.tag !== undefined) data.tag = emptyToNull(data.tag);
    const updated = await locationsModel.updateLocation(parsedId.data.id, data);
    if (updated === 'duplicate') return duplicate(res);
    if (!updated) return res.status(404).json({ error: 'Location not found' });
    res.json(toLocationResponse(updated));
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/locations/order - body: { ids: [3, 1, 2, ...] } listing
// every location exactly once, in the new order
async function reorderAdminLocations(req, res, next) {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const { ids } = parsed.data;
    const existing = (await locationsModel.getAllLocations()).map((l) => l.id);
    const same =
      ids.length === existing.length && new Set(ids).size === ids.length && ids.every((id) => existing.includes(id));
    if (!same) {
      return res.status(400).json({ error: 'The new order must list every location exactly once' });
    }
    await locationsModel.reorderLocations(ids);
    const rows = await locationsModel.getAllLocations();
    res.json({ data: rows.map(toLocationResponse) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/locations/:id
async function deleteAdminLocation(req, res, next) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationErrors(res, parsed);
    const deleted = await locationsModel.deleteLocation(parsed.data.id);
    if (!deleted) return res.status(404).json({ error: 'Location not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAdminLocations,
  createAdminLocation,
  updateAdminLocation,
  reorderAdminLocations,
  deleteAdminLocation,
};
