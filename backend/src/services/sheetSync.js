const crypto = require('crypto');
const pool = require('../config/db');
const sheets = require('./googleSheets');
const carsModel = require('../models/cars');
const carTypesModel = require('../models/carTypes');
const locationsModel = require('../models/locations');
const enquiriesModel = require('../models/enquiries');
const { adminCarSchema, TRANSMISSIONS, FUELS } = require('../controllers/adminCars');
const { locationNameSchema, locationTagSchema } = require('../controllers/adminLocations');
const { ENQUIRY_STATUSES, formatDateOnly, formatTimeOnly } = require('../controllers/adminEnquiries');

// Two-way sync between the database and one Google Sheet with three tabs:
// Cars, Locations and Enquiries.
//
// The database stays the source of truth. One sync run, per tab:
//   1. read the tab and compare each row's editable cells with what we
//      wrote there last time (a hash kept in the sheet_sync_rows table)
//   2. rows changed in the sheet are checked with the SAME rules as the
//      admin panel and saved; rows with an empty ID are added as new
//   3. the tab is rewritten from the database, so website changes show up
//      and new rows get their ID
// A row the rules reject is not saved: the sheet keeps what was typed and
// the "Sync note" column says what is wrong, until it is fixed.
// Deleting a row in the sheet deletes nothing: the next run puts it back.
//
// A sync runs a few seconds after any admin change or new enquiry. Every
// minute the sheet alone is read (no database query, so Neon's free
// database can still go to sleep); only if it differs from what we last
// wrote does a full sync run.

const POLL_MS = 60 * 1000;
const DEBOUNCE_MS = 3000;
const NOTE_HEADER = 'Sync note';
const YES_NO = ['Yes', 'No'];
const STATUS_LABELS = { new: 'New', contacted: 'Contacted', confirmed: 'Booked', closed: 'Closed' };

// A problem with one row, shown in its Sync note
class RowError extends Error {}

const str = (v) => (v == null ? '' : String(v));
const norm = (v) => str(v).replace(/\r\n/g, '\n').trim();
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const fuelLabel = (f) => (f === 'cng' ? 'CNG' : capitalize(f));

function parseYesNo(value, column) {
  const v = norm(value).toLowerCase();
  if (['yes', 'y', 'true'].includes(v)) return true;
  if (['no', 'n', 'false', ''].includes(v)) return false;
  throw new RowError(`${column}: write Yes or No`);
}

// The first problem zod found, named by the sheet column
function zodMessage(result, columnNames) {
  const issue = result.error.issues[0];
  const field = String(issue.path[0] ?? '');
  return `${columnNames[field] || field}: ${issue.message}`;
}

// "2026-10-07T09:30:00Z" -> "2026-10-07 15:00" (India time)
function indiaDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// ---------- Tabs ----------

const CAR_COLUMNS = {
  name: 'Name',
  brand: 'Brand',
  type: 'Type',
  seats: 'Seats',
  transmission: 'Transmission',
  fuel: 'Fuel',
  pricePerDay: 'Price per day (₹)',
  images: 'Photo links (one per line)',
  description: 'Description',
  isAvailable: 'Show on website',
};

// Sheet cells -> the admin panel's car shape, checked by its rules
function parseCar(cells, ctx) {
  const required = { name: 'Name', brand: 'Brand', type: 'Type', seats: 'Seats', transmission: 'Transmission', fuel: 'Fuel', price: 'Price per day (₹)' };
  const empty = Object.keys(required).filter((k) => norm(cells[k]) === '');
  if (empty.length) throw new RowError(`Fill in: ${empty.map((k) => required[k]).join(', ')}`);

  const typeText = norm(cells.type).toLowerCase();
  const type = ctx.types.find((t) => t.slug === typeText || t.label.toLowerCase() === typeText);
  if (!type) throw new RowError(`Type: "${norm(cells.type)}" is not a car type. Pick one from the list`);

  const seatsText = norm(cells.seats);
  if (!/^\d+$/.test(seatsText)) throw new RowError('Seats: write a whole number, like 5');
  const priceText = norm(cells.price).replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(priceText)) throw new RowError('Price per day (₹): write a number, like 2500');

  const result = adminCarSchema.safeParse({
    name: norm(cells.name),
    brand: norm(cells.brand),
    type: type.slug,
    seats: Number(seatsText),
    transmission: norm(cells.transmission).toLowerCase(),
    fuel: norm(cells.fuel).toLowerCase(),
    pricePerDay: Number(priceText),
    images: norm(cells.photos)
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    description: norm(cells.description),
    isAvailable: parseYesNo(cells.available, 'Show on website'),
  });
  if (!result.success) throw new RowError(zodMessage(result, CAR_COLUMNS));
  const d = result.data;
  return {
    payload: {
      name: d.name,
      brand: d.brand,
      type: d.type,
      seats: d.seats,
      transmission: d.transmission,
      fuel: d.fuel,
      price_per_day: d.pricePerDay,
      images: d.images,
      description: d.description || null,
      is_available: d.isAvailable,
    },
    featured: parseYesNo(cells.featured, 'Featured'),
  };
}

const carsTab = {
  title: 'Cars',
  columns: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name', edit: true },
    { key: 'brand', header: 'Brand', edit: true },
    { key: 'type', header: 'Type', edit: true, list: (ctx) => ctx.types.map((t) => t.label) },
    { key: 'seats', header: 'Seats', edit: true },
    { key: 'transmission', header: 'Transmission', edit: true, list: () => TRANSMISSIONS.map(capitalize) },
    { key: 'fuel', header: 'Fuel', edit: true, list: () => FUELS.map(fuelLabel) },
    { key: 'price', header: 'Price per day (₹)', edit: true },
    { key: 'available', header: 'Show on website', edit: true, list: () => YES_NO },
    { key: 'featured', header: 'Featured', edit: true, list: () => YES_NO },
    { key: 'description', header: 'Description', edit: true },
    { key: 'photos', header: 'Photo links (one per line)', edit: true },
  ],
  async load(ctx) {
    const label = (slug) => ctx.types.find((t) => t.slug === slug)?.label || slug;
    return (await carsModel.getAllCarsUnpaged()).map((c) => ({
      id: c.id,
      cells: {
        id: str(c.id),
        name: str(c.name),
        brand: str(c.brand),
        type: label(c.type),
        seats: str(c.seats),
        transmission: capitalize(str(c.transmission)),
        fuel: fuelLabel(str(c.fuel)),
        price: str(Number(c.price_per_day)),
        available: c.is_available ? 'Yes' : 'No',
        featured: c.is_featured ? 'Yes' : 'No',
        description: str(c.description),
        photos: (c.images || []).join('\n'),
      },
      raw: c,
    }));
  },
  async update(id, cells, ctx, before) {
    const { payload, featured } = parseCar(cells, ctx);
    const updated = await carsModel.updateCar(id, payload);
    if (!updated) throw new RowError('This car no longer exists');
    if (featured !== before.raw.is_featured) {
      await carsModel.setFeatured(id, featured, featured ? (before.raw.featured_order ?? null) : null);
    }
  },
  async create(cells, ctx) {
    const { payload, featured } = parseCar(cells, ctx);
    const created = await carsModel.createCar(payload);
    if (featured) await carsModel.setFeatured(created.id, true, null);
  },
};

const locationsTab = {
  title: 'Locations',
  columns: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name', edit: true },
    { key: 'tag', header: 'Label (shown in brackets)', edit: true },
  ],
  async load() {
    return (await locationsModel.getAllLocations()).map((l) => ({
      id: l.id,
      cells: { id: str(l.id), name: str(l.name), tag: str(l.tag) },
      raw: l,
    }));
  },
  parse(cells) {
    const name = locationNameSchema.safeParse(norm(cells.name));
    if (!name.success) throw new RowError(`Name: ${name.error.issues[0].message}`);
    const tag = locationTagSchema.safeParse(norm(cells.tag));
    if (!tag.success) throw new RowError(`Label: ${tag.error.issues[0].message}`);
    return { name: name.data, tag: tag.data || null };
  },
  async update(id, cells) {
    const updated = await locationsModel.updateLocation(id, this.parse(cells));
    if (updated === 'duplicate') throw new RowError('Name: another location already has this name');
    if (!updated) throw new RowError('This location no longer exists');
  },
  async create(cells) {
    const created = await locationsModel.createLocation(this.parse(cells));
    if (!created) throw new RowError('Name: another location already has this name');
  },
};

const enquiriesTab = {
  title: 'Enquiries',
  columns: [
    { key: 'id', header: 'ID' },
    { key: 'received', header: 'Received (India time)' },
    { key: 'status', header: 'Status', edit: true, list: () => Object.values(STATUS_LABELS) },
    { key: 'notes', header: 'Notes', edit: true },
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'car', header: 'Car' },
    { key: 'pickupLocation', header: 'Pickup location' },
    { key: 'dropoffLocation', header: 'Drop-off location' },
    { key: 'startDate', header: 'Pickup date' },
    { key: 'pickupTime', header: 'Pickup time' },
    { key: 'endDate', header: 'Return date' },
    { key: 'dropoffTime', header: 'Return time' },
    { key: 'message', header: 'Customer message' },
  ],
  noCreateNote: "New enquiries can't be added here. They come from the website's booking form.",
  async load() {
    return (await enquiriesModel.getAllEnquiriesUnpaged()).map((e) => ({
      id: e.id,
      cells: {
        id: str(e.id),
        received: indiaDateTime(e.created_at),
        status: STATUS_LABELS[e.status] || e.status,
        notes: str(e.notes),
        name: str(e.name),
        phone: str(e.phone),
        email: str(e.email),
        car: e.car_name ? e.car_name : e.car_id ? `(deleted car ${e.car_id})` : '',
        pickupLocation: str(e.pickup_location),
        dropoffLocation: str(e.dropoff_location),
        startDate: str(formatDateOnly(e.start_date)),
        pickupTime: str(formatTimeOnly(e.pickup_time)),
        endDate: str(formatDateOnly(e.end_date)),
        dropoffTime: str(formatTimeOnly(e.dropoff_time)),
        message: str(e.message),
      },
      raw: e,
    }));
  },
  async update(id, cells) {
    const label = norm(cells.status).toLowerCase();
    const status = ENQUIRY_STATUSES.find((s) => s === label || STATUS_LABELS[s].toLowerCase() === label);
    if (!status) throw new RowError(`Status: pick one of ${Object.values(STATUS_LABELS).join(', ')}`);
    const notes = norm(cells.notes);
    if (notes.length > 2000) throw new RowError('Notes: at most 2000 characters');
    const updated = await enquiriesModel.updateEnquiry(id, { status, notes });
    if (!updated) throw new RowError('This enquiry no longer exists');
  },
};

const TABS = [carsTab, locationsTab, enquiriesTab];

// ---------- One tab ----------

const headersOf = (tab) => [...tab.columns.map((c) => c.header), NOTE_HEADER];
const rowOf = (tab, cells, note = '') => [...tab.columns.map((c) => str(cells[c.key])), note];

function hashCells(tab, cells) {
  const editable = tab.columns.filter((c) => c.edit).map((c) => norm(cells[c.key]));
  return crypto.createHash('sha256').update(JSON.stringify(editable)).digest('hex');
}

function sameValues(a, b) {
  const trimRow = (r) => {
    const out = r.map(norm);
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  };
  const rows = (v) => {
    const out = v.map(trimRow);
    while (out.length && out[out.length - 1].length === 0) out.pop();
    return out;
  };
  return JSON.stringify(rows(a)) === JSON.stringify(rows(b));
}

// Applies the tab's sheet edits to the database, then works out what the
// tab should hold now. Pure database work: the caller reads and writes the
// sheet. Exported for the tests.
async function syncTab(tab, values, snapshot, ctx) {
  const headers = headersOf(tab);
  const headerOk = values.length > 0 && headers.every((h, i) => norm(values[0][i]) === h);
  const before = new Map((await tab.load(ctx)).map((r) => [r.id, r]));
  const kept = new Map(); // id -> { cells, note } rows that stay as typed
  const failedNew = [];
  let applied = 0;

  // A tab with other headers (new, or columns renamed / moved) is not read:
  // it is simply rewritten
  if (headerOk) {
    for (const row of values.slice(1)) {
      const cells = Object.fromEntries(tab.columns.map((c, i) => [c.key, row[i] ?? '']));
      const hasContent = tab.columns.some((c) => norm(cells[c.key]) !== '');
      if (!hasContent) continue;
      const idText = norm(cells.id);
      const id = /^\d+$/.test(idText) ? Number(idText) : null;

      try {
        if (id !== null) {
          const old = before.get(id);
          const lastHash = snapshot.get(id);
          // Unknown id (deleted on the website), or never synced: the
          // database wins
          if (!old || lastHash === undefined || hashCells(tab, cells) === lastHash) continue;
          await tab.update(id, cells, ctx, old);
          applied++;
        } else if (idText !== '') {
          throw new RowError('ID: leave this empty for a new row. IDs are filled in automatically');
        } else if (!tab.create) {
          throw new RowError(tab.noCreateNote);
        } else {
          await tab.create(cells, ctx);
          applied++;
        }
      } catch (err) {
        if (!(err instanceof RowError)) throw err;
        if (id !== null) kept.set(id, { cells, note: err.message });
        else failedNew.push({ cells, note: err.message });
      }
    }
  }

  const after = applied > 0 ? await tab.load(ctx) : [...before.values()];
  const rows = [headers];
  const nextSnapshot = new Map();
  for (const r of after) {
    const k = kept.get(r.id);
    if (k) {
      rows.push(rowOf(tab, k.cells, k.note));
      nextSnapshot.set(r.id, snapshot.get(r.id));
    } else {
      rows.push(rowOf(tab, r.cells));
      nextSnapshot.set(r.id, hashCells(tab, r.cells));
    }
  }
  for (const f of failedNew) rows.push(rowOf(tab, f.cells, f.note));

  return {
    rows,
    snapshot: nextSnapshot,
    applied,
    problems: kept.size + failedNew.length,
    changed: !sameValues(values, rows),
  };
}

// ---------- Sheet layout ----------

// Bold frozen header, dropdowns on list columns, and a warning when someone
// edits a column the sync overwrites (ID, enquiry details, Sync note)
function layoutRequests(tab, sheetId, existingProtections, ctx) {
  const ncols = tab.columns.length + 1;
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: ncols },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.96, green: 0.71, blue: 0 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ];
  tab.columns.forEach((c, i) => {
    if (!c.list) return;
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: c.list(ctx).map((v) => ({ userEnteredValue: v })) },
          strict: true,
          showCustomUi: true,
        },
      },
    });
  });
  const marker = `drivekochi-sync:${tab.title}`;
  if (!existingProtections.includes(marker)) {
    tab.columns.forEach((c, i) => {
      if (c.edit) return;
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
            description: marker,
            warningOnly: true,
          },
        },
      });
    });
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startColumnIndex: ncols - 1, endColumnIndex: ncols },
          description: marker,
          warningOnly: true,
        },
      },
    });
  }
  return requests;
}

// Creates missing tabs. Returns { title: { sheetId, protections } }.
async function ensureTabs() {
  let meta = await sheets.getSpreadsheet();
  const titles = () => meta.sheets.map((s) => s.properties.title);
  const missing = TABS.filter((t) => !titles().includes(t.title));
  if (missing.length) {
    await sheets.batchUpdate(missing.map((t) => ({ addSheet: { properties: { title: t.title } } })));
    meta = await sheets.getSpreadsheet();
  }
  return Object.fromEntries(
    meta.sheets.map((s) => [
      s.properties.title,
      { sheetId: s.properties.sheetId, protections: (s.protectedRanges || []).map((p) => p.description) },
    ])
  );
}

// ---------- Snapshot (what we last wrote, per row) ----------

async function loadSnapshots() {
  const { rows } = await pool.query('SELECT tab, row_id, hash FROM sheet_sync_rows');
  const byTab = new Map(TABS.map((t) => [t.title, new Map()]));
  for (const r of rows) byTab.get(r.tab)?.set(r.row_id, r.hash);
  return byTab;
}

async function saveSnapshot(title, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM sheet_sync_rows WHERE tab = $1', [title]);
    const ids = [...snapshot.keys()];
    if (ids.length) {
      await client.query(
        'INSERT INTO sheet_sync_rows (tab, row_id, hash) SELECT $1, * FROM UNNEST($2::int[], $3::text[])',
        [title, ids, ids.map((id) => snapshot.get(id))]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Running ----------

const state = {
  running: null,
  again: false,
  // What each tab held after the last sync, to spot sheet edits cheaply
  lastRows: null,
  lastSyncAt: null,
  lastCheckAt: null,
  lastError: null,
  lastApplied: 0,
  problems: 0,
};

async function syncOnce() {
  const tabsMeta = await ensureTabs();
  const ctx = { types: await carTypesModel.getAllTypes() };
  const snapshots = await loadSnapshots();
  const values = await sheets.readTabs(TABS.map((t) => t.title));
  let applied = 0;
  let problems = 0;
  const layout = [];

  const lastRows = {};
  for (const [i, tab] of TABS.entries()) {
    const result = await syncTab(tab, values[i], snapshots.get(tab.title), ctx);
    applied += result.applied;
    problems += result.problems;
    lastRows[tab.title] = result.rows;
    if (result.changed) {
      await sheets.writeTab(tab.title, result.rows);
      const meta = tabsMeta[tab.title];
      layout.push(...layoutRequests(tab, meta.sheetId, meta.protections, ctx));
    }
    await saveSnapshot(tab.title, result.snapshot);
  }
  await sheets.batchUpdate(layout);
  state.lastRows = lastRows;
  return { applied, problems };
}

// The minute check: true if the sheet differs from what the last sync left
// there (someone edited it), or nothing has been synced since start-up
async function sheetChanged() {
  if (!state.lastRows) return true;
  const values = await sheets.readTabs(TABS.map((t) => t.title));
  return TABS.some((tab, i) => !sameValues(values[i], state.lastRows[tab.title] || []));
}

async function pollSync() {
  if (state.running || !sheets.isConfigured() || !pool) return;
  try {
    if (await sheetChanged()) await runSync();
    else state.lastError = null;
    state.lastCheckAt = new Date().toISOString();
  } catch (err) {
    if (state.lastError !== err.message) console.error('sheet sync check failed:', err.message);
    state.lastError = err.message;
  }
}

// Runs a sync now, or once more right after the one in progress
function runSync() {
  if (!sheets.isConfigured() || !pool) return Promise.resolve(null);
  if (state.running) {
    state.again = true;
    return state.running;
  }
  state.running = (async () => {
    try {
      do {
        state.again = false;
        const { applied, problems } = await syncOnce();
        state.lastSyncAt = new Date().toISOString();
        state.lastCheckAt = state.lastSyncAt;
        state.lastError = null;
        state.lastApplied = applied;
        state.problems = problems;
        if (applied) console.log(`sheet sync: ${applied} change(s) from the sheet saved`);
      } while (state.again);
    } catch (err) {
      if (state.lastError !== err.message) console.error('sheet sync failed:', err.message);
      state.lastError = err.message;
    } finally {
      state.running = null;
    }
    return state;
  })();
  return state.running;
}

// After a website change: sync a few seconds later (changes in quick
// succession share one run)
let debounceTimer = null;
function scheduleSync() {
  if (!sheets.isConfigured()) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSync, DEBOUNCE_MS);
  debounceTimer.unref?.();
}

function startSheetSync() {
  if (!sheets.isConfigured()) {
    if (process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error('sheet sync: GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON must both be set (and valid)');
    }
    return;
  }
  console.log(`sheet sync: on, every ${POLL_MS / 1000}s, as ${sheets.serviceAccountEmail()}`);
  setTimeout(runSync, 5000).unref?.();
  setInterval(pollSync, POLL_MS).unref?.();
}

function getStatus() {
  return {
    configured: sheets.isConfigured(),
    sheetUrl: sheets.sheetUrl(),
    serviceAccountEmail: sheets.serviceAccountEmail(),
    running: !!state.running,
    lastSyncAt: state.lastSyncAt,
    lastCheckAt: state.lastCheckAt,
    lastError: state.lastError,
    lastApplied: state.lastApplied,
    problems: state.problems,
  };
}

module.exports = { startSheetSync, scheduleSync, runSync, pollSync, getStatus, syncTab, TABS, RowError };
