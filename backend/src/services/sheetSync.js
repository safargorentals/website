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
const { NAME_RE, PHONE_RE, isRealDate } = require('../controllers/enquiries');

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
// Something deleted on the website stays in the sheet, marked "Removed from
// the website" in its Sync note.
//
// A sync runs a few seconds after any admin change or new enquiry. Every
// 10 seconds the sheet alone is read (no database query, so Neon's free
// database can still go to sleep); only if it differs from what we last
// wrote does a full sync run.

const POLL_MS = 10 * 1000;
const DEBOUNCE_MS = 1500;
const REMOVED_NOTE = 'Removed from the website';
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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad2 = (n) => String(n).padStart(2, '0');

// A date as typed in the sheet -> 'YYYY-MM-DD', or null.
// 2026-10-12, 12/10/2026, 12-10-2026, 12.10.2026 (day first, as in India),
// 12 Oct 2026, Oct 12, 2026
function parseSheetDate(value) {
  const v = norm(value).toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let y, m, d, match;
  if ((match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = match;
  else if ((match = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = match;
  else if ((match = v.match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/))) {
    [, d, m, y] = match;
    m = MONTHS.indexOf(m) + 1;
  } else if ((match = v.match(/^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})$/))) {
    [, m, d, y] = match;
    m = MONTHS.indexOf(m) + 1;
  } else return null;
  const iso = `${y}-${pad2(m)}-${pad2(d)}`;
  return Number(m) >= 1 && isRealDate(iso) ? iso : null;
}

// A time as typed in the sheet -> 'HH:MM' (24-hour), or null.
// 14:30, 14:30:00, 2:30 PM, 2 pm, 9.30 a.m.
function parseSheetTime(value) {
  const v = norm(value)
    .toLowerCase()
    .replace(/(\d)\.(\d)/g, '$1:$2') // 9.30 -> 9:30
    .replace(/\./g, '') // a.m. -> am
    .replace(/\s+/g, ' ');
  const match = v.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})? ?(am|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2] || 0);
  const ampm = match[3];
  if (!ampm && match[2] === undefined) return null; // a bare "14" is too vague
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm === 'pm' ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
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
  color: '#f4b400',
  columns: [
    { key: 'id', header: 'ID', width: 56 },
    { key: 'name', header: 'Name', edit: true, width: 200 },
    { key: 'brand', header: 'Brand', edit: true },
    { key: 'type', header: 'Type', edit: true, list: (ctx) => ctx.types.map((t) => t.label) },
    { key: 'seats', header: 'Seats', edit: true },
    { key: 'transmission', header: 'Transmission', edit: true, list: () => TRANSMISSIONS.map(capitalize) },
    { key: 'fuel', header: 'Fuel', edit: true, list: () => FUELS.map(fuelLabel) },
    { key: 'price', header: 'Price per day (₹)', edit: true },
    { key: 'available', header: 'Show on website', edit: true, list: () => YES_NO },
    { key: 'featured', header: 'Featured', edit: true, list: () => YES_NO },
    { key: 'description', header: 'Description', edit: true, width: 280 },
    { key: 'photos', header: 'Photo links (one per line)', edit: true, width: 280 },
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
  color: '#1d5a40',
  columns: [
    { key: 'id', header: 'ID', width: 56 },
    { key: 'name', header: 'Name', edit: true, width: 220 },
    { key: 'tag', header: 'Label (shown in brackets)', edit: true, width: 200 },
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
  color: '#1c7ed6',
  columns: [
    { key: 'id', header: 'ID', width: 56 },
    { key: 'received', header: 'Received (India time)', width: 150 },
    { key: 'status', header: 'Status', edit: true, width: 120, list: () => Object.values(STATUS_LABELS) },
    { key: 'notes', header: 'Notes', edit: true, width: 240 },
    { key: 'name', header: 'Name', edit: true },
    { key: 'phone', header: 'Phone', edit: true },
    { key: 'email', header: 'Email', edit: true },
    { key: 'car', header: 'Car', edit: true, width: 180, list: (ctx) => ctx.cars.map((c) => c.name) },
    { key: 'pickupLocation', header: 'Pickup location', edit: true },
    { key: 'dropoffLocation', header: 'Drop-off location', edit: true },
    { key: 'startDate', header: 'Pickup date', edit: true },
    { key: 'pickupTime', header: 'Pickup time', edit: true },
    { key: 'endDate', header: 'Return date', edit: true },
    { key: 'dropoffTime', header: 'Return time', edit: true },
    { key: 'message', header: 'Customer message', edit: true, width: 280 },
  ],
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
  async update(id, cells, ctx, before) {
    const { details, status, notes } = parseEnquiry(cells, ctx, before);
    const updated = await enquiriesModel.updateEnquiryDetails(id, details);
    if (!updated) throw new RowError('This enquiry no longer exists');
    await enquiriesModel.updateEnquiry(id, { status, notes });
  },
  // A booking typed into the sheet (e.g. taken by phone)
  async create(cells, ctx) {
    const { details, status, notes } = parseEnquiry(cells, ctx, null);
    const saved = await enquiriesModel.createEnquiry({
      name: details.name,
      phone: details.phone,
      email: details.email,
      carId: details.car_id,
      pickupLocation: details.pickup_location,
      dropoffLocation: details.dropoff_location,
      startDate: details.start_date,
      endDate: details.end_date,
      pickupTime: details.pickup_time,
      dropoffTime: details.dropoff_time,
      message: details.message,
    });
    await enquiriesModel.updateEnquiry(saved.id, { status, notes });
  },
};

// Sheet cells -> an enquiry, checked like the booking form (except that
// past dates are allowed, for corrections and bookings taken earlier).
// before: the current row when editing, null for a new one.
function parseEnquiry(cells, ctx, before) {
  const required = { name: 'Name', phone: 'Phone', pickupLocation: 'Pickup location', dropoffLocation: 'Drop-off location', startDate: 'Pickup date', pickupTime: 'Pickup time', endDate: 'Return date', dropoffTime: 'Return time' };
  const empty = Object.keys(required).filter((k) => norm(cells[k]) === '');
  if (empty.length) throw new RowError(`Fill in: ${empty.map((k) => required[k]).join(', ')}`);

  const statusText = norm(cells.status).toLowerCase() || 'new';
  const status = ENQUIRY_STATUSES.find((s) => s === statusText || STATUS_LABELS[s].toLowerCase() === statusText);
  if (!status) throw new RowError(`Status: pick one of ${Object.values(STATUS_LABELS).join(', ')}`);
  const notes = norm(cells.notes);
  if (notes.length > 2000) throw new RowError('Notes: at most 2000 characters');

  const name = norm(cells.name);
  if (name.length < 2 || name.length > 100 || !NAME_RE.test(name)) {
    throw new RowError('Name: letters only, at least 2 characters');
  }
  const phone = norm(cells.phone);
  const digits = phone.replace(/\D/g, '').length;
  if (!PHONE_RE.test(phone) || digits < 10 || digits > 13) {
    throw new RowError('Phone: 10 to 13 digits, like +91 98765 43210');
  }
  const email = norm(cells.email);
  if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))) {
    throw new RowError('Email: not a valid email address');
  }

  // Car: a name from the Cars tab, or empty. An unchanged cell keeps the
  // current car (even one that was deleted since).
  const carText = norm(cells.car);
  let carId = null;
  if (before && carText === before.cells.car) carId = before.raw.car_id;
  else if (carText) {
    const car = ctx.cars.find((c) => c.name.toLowerCase() === carText.toLowerCase());
    if (!car) throw new RowError('Car: no car with this name. Pick one from the list, or leave it empty');
    carId = car.id;
  }

  const place = (key, column) => {
    const v = norm(cells[key]);
    if (v.length < 2 || v.length > 200) throw new RowError(`${column}: write the place, like Kochi Airport`);
    return v;
  };
  const date = (key, column) => {
    const v = parseSheetDate(cells[key]);
    if (!v) throw new RowError(`${column}: write a date like 12/10/2026`);
    return v;
  };
  const time = (key, column) => {
    const v = parseSheetTime(cells[key]);
    if (!v) throw new RowError(`${column}: write a time like 10:00 AM or 14:30`);
    return v;
  };
  const startDate = date('startDate', 'Pickup date');
  const endDate = date('endDate', 'Return date');
  if (endDate < startDate) throw new RowError('Return date: must be on or after the pickup date');
  const message = norm(cells.message);
  if (message.length > 1000) throw new RowError('Customer message: at most 1000 characters');

  return {
    status,
    notes,
    details: {
      name,
      phone,
      email: email || null,
      car_id: carId,
      pickup_location: place('pickupLocation', 'Pickup location'),
      dropoff_location: place('dropoffLocation', 'Drop-off location'),
      start_date: startDate,
      end_date: endDate,
      pickup_time: time('pickupTime', 'Pickup time'),
      dropoff_time: time('dropoffTime', 'Return time'),
      message: message || null,
    },
  };
}

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
  const removedRows = new Map(); // id -> cells: deleted on the website
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
      const old = id !== null ? before.get(id) : undefined;
      // An ID we have written before (in the snapshot) that the database no
      // longer has: deleted on the website. Keep the row, marked.
      if (id !== null && !old && snapshot.has(id)) {
        removedRows.set(id, cells);
        continue;
      }

      try {
        if (old) {
          // Never synced (first run): the database wins. Unchanged: nothing to do.
          const lastHash = snapshot.get(id);
          if (lastHash === undefined || hashCells(tab, cells) === lastHash) continue;
          await tab.update(id, cells, ctx, old);
          applied++;
        } else if (!tab.create) {
          throw new RowError(tab.noCreateNote);
        } else {
          // Empty ID, or an ID the website never had (typed or copied in):
          // a new row. The website gives it its own ID.
          await tab.create(cells, ctx);
          applied++;
        }
      } catch (err) {
        if (!(err instanceof RowError)) throw err;
        if (old) kept.set(id, { cells, note: err.message });
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
  // Deleted on the website: the row stays, marked, and its ID stays known
  // so it is never mistaken for a new row
  for (const [id, cells] of removedRows) {
    rows.push(rowOf(tab, cells, REMOVED_NOTE));
    nextSnapshot.set(id, 'removed');
  }
  for (const f of failedNew) rows.push(rowOf(tab, f.cells, f.note));
  const removed = removedRows.size;

  return {
    rows,
    snapshot: nextSnapshot,
    applied,
    problems: kept.size + failedNew.length,
    removed,
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
            textFormat: { bold: true, foregroundColor: rgb('#f4b400') },
            backgroundColor: rgb('#17201b'),
            verticalAlignment: 'MIDDLE',
            padding: { top: 6, bottom: 6, left: 8, right: 8 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor,verticalAlignment,padding)',
      },
    },
  ];
  tab.columns.forEach((c, i) => {
    if (!c.list) return;
    const values = c.list(ctx);
    const range = { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 };
    // Google refuses an empty list (e.g. no cars yet): then no dropdown
    if (values.length === 0) return requests.push({ setDataValidation: { range } });
    requests.push({
      setDataValidation: {
        range,
        rule: {
          condition: { type: 'ONE_OF_LIST', values: values.map((v) => ({ userEnteredValue: v })) },
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

// '#f4b400' -> Sheets colour
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

// Column index -> letter (0 -> A, 26 -> AA)
function colLetter(i) {
  let out = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
}

const STATUS_COLORS = {
  New: ['#e7f0fd', '#1c64c8'],
  Contacted: ['#fff4d6', '#9a6700'],
  Booked: ['#e3f6ea', '#1d7a46'],
  Closed: ['#eeeeee', '#6e766f'],
};

// The look of a tab, applied once (when it has no striped rows yet):
// striped rows, column widths, tab colour, coloured Status / Yes-No cells,
// red Sync notes, and greyed-out, struck-through rows removed from the website
function styleRequests(tab, sheetId) {
  const ncols = tab.columns.length + 1;
  const noteCol = colLetter(ncols - 1);
  const all = { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: ncols };
  const columnOf = (key) => tab.columns.findIndex((c) => c.key === key);
  const rule = (ranges, condition, format) => ({
    addConditionalFormatRule: { index: 0, rule: { ranges, booleanRule: { condition, format } } },
  });
  const formula = (f) => ({ type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: f }] });
  const textIs = (v) => ({ type: 'TEXT_EQ', values: [{ userEnteredValue: v }] });
  const col = (i) => ({ sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 });

  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, tabColorStyle: { rgbColor: rgb(tab.color) }, gridProperties: { frozenColumnCount: 1 } },
        fields: 'tabColorStyle,gridProperties.frozenColumnCount',
      },
    },
    {
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: ncols },
          rowProperties: {
            headerColor: rgb('#17201b'),
            firstBandColor: rgb('#ffffff'),
            secondBandColor: rgb('#fbf7ef'),
          },
        },
      },
    },
    {
      repeatCell: {
        range: all,
        cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP', padding: { left: 8, right: 8, top: 4, bottom: 4 } } },
        fields: 'userEnteredFormat(verticalAlignment,wrapStrategy,padding)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: ncols - 1, endIndex: ncols },
        properties: { pixelSize: 260 },
        fields: 'pixelSize',
      },
    },
    // ID column: small and grey
    {
      repeatCell: {
        range: col(0),
        cell: { userEnteredFormat: { textFormat: { foregroundColor: rgb('#868e96') }, horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.horizontalAlignment',
      },
    },
  ];
  tab.columns.forEach((c, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: c.width || 130 },
        fields: 'pixelSize',
      },
    });
  });

  // Added last, so it ends up first and wins: rows removed from the website
  const rules = [];
  const status = columnOf('status');
  if (status >= 0) {
    for (const [label, [bg, fg]] of Object.entries(STATUS_COLORS)) {
      rules.push(rule([col(status)], textIs(label), { backgroundColor: rgb(bg), textFormat: { foregroundColor: rgb(fg), bold: true } }));
    }
  }
  for (const key of ['available', 'featured']) {
    const i = columnOf(key);
    if (i < 0) continue;
    rules.push(rule([col(i)], textIs('Yes'), { textFormat: { foregroundColor: rgb('#1d7a46'), bold: true } }));
    rules.push(rule([col(i)], textIs('No'), { textFormat: { foregroundColor: rgb('#868e96') } }));
  }
  rules.push(
    rule([col(ncols - 1)], formula(`=AND(${noteCol}2<>"", ${noteCol}2<>"${REMOVED_NOTE}")`), {
      backgroundColor: rgb('#fdecea'),
      textFormat: { foregroundColor: rgb('#c0392b'), bold: true },
    })
  );
  rules.push(
    rule([all], formula(`=$${noteCol}2="${REMOVED_NOTE}"`), {
      backgroundColor: rgb('#f1f1f1'),
      textFormat: { foregroundColor: rgb('#9aa0a6'), strikethrough: true },
    })
  );
  return [...requests, ...rules];
}

// Creates missing tabs. Returns { title: { sheetId, protections, styled } }.
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
      {
        sheetId: s.properties.sheetId,
        protections: (s.protectedRanges || []).map((p) => p.description),
        styled: (s.bandedRanges || []).length > 0,
      },
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
  const ctx = { types: await carTypesModel.getAllTypes(), cars: await carsModel.getAllCarsUnpaged() };
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
    const meta = tabsMeta[tab.title];
    if (result.changed) await sheets.writeTab(tab.title, result.rows);
    // Header, dropdowns and warnings after each rewrite; the full look once
    // per tab (also for a tab that existed before the styling was added)
    if (result.changed || !meta.styled) layout.push(...layoutRequests(tab, meta.sheetId, meta.protections, ctx));
    if (!meta.styled) layout.push(...styleRequests(tab, meta.sheetId));
    // A car added from the sheet can be picked on the Enquiries tab in the
    // same run
    if (tab === carsTab && result.applied) ctx.cars = await carsModel.getAllCarsUnpaged();
    await saveSnapshot(tab.title, result.snapshot);
  }
  state.lastRows = lastRows;
  // The data is synced at this point. If Google refuses the formatting, say
  // so, but don't treat the whole sync as failed (that would re-run it, and
  // query the database, on every check)
  let warning = null;
  try {
    await sheets.batchUpdate(layout);
  } catch (err) {
    warning = `Data synced, but the sheet formatting failed: ${err.message}`;
  }
  return { applied, problems, warning };
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
        const { applied, problems, warning } = await syncOnce();
        state.lastSyncAt = new Date().toISOString();
        state.lastCheckAt = state.lastSyncAt;
        if (warning && warning !== state.lastError) console.error('sheet sync:', warning);
        state.lastError = warning;
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
