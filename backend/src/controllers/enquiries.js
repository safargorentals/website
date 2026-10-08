const { z } = require('zod');
const enquiriesModel = require('../models/enquiries');
const carsModel = require('../models/cars');
const { notifyNewEnquiry } = require('../services/notifyEnquiry');
const phoneToken = require('../services/phoneToken');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[0-9\s+\-()]+$/;
// Letters (any language), spaces and . ' -
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

// Today as YYYY-MM-DD, so date strings can be compared directly
function todayString() {
  const t = new Date();
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${mm}-${dd}`;
}

// "2026-13-01" matches the YYYY-MM-DD pattern but is not a real date
function isRealDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// What POST /api/enquiries must look like.
// Strings are trimmed, so "  Ali  " becomes "Ali".
const enquiryBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .regex(NAME_RE, 'Name may only contain letters, spaces and . \' -'),
    phone: z
      .string()
      .trim()
      .regex(PHONE_RE, 'Phone may only contain digits, spaces and + - ( )')
      .min(7, 'Phone must be at least 7 characters')
      .max(20, 'Phone must be at most 20 characters')
      .refine((v) => {
        const digits = v.replace(/\D/g, '').length;
        return digits >= 10 && digits <= 13;
      }, 'Phone must have 10 to 13 digits'),
    email: z
      .union([
        z.literal(''),
        z.string().trim().max(100, 'Email must be at most 100 characters').email('Must be a valid email'),
      ])
      .optional(),
    carId: z
      .union([
        z.literal(null),
        z.coerce.number().int().min(1, 'carId must be a positive integer'),
      ])
      .optional(),
    pickupLocation: z
      .string()
      .trim()
      .min(2, 'Pickup location must be at least 2 characters')
      .max(200, 'Pickup location must be at most 200 characters'),
    dropoffLocation: z
      .string()
      .trim()
      .min(2, 'Dropoff location must be at least 2 characters')
      .max(200, 'Dropoff location must be at most 200 characters'),
    startDate: z
      .string()
      .regex(DATE_RE, 'startDate must be in YYYY-MM-DD format')
      .refine(isRealDate, 'startDate must be a real calendar date')
      .refine((v) => v >= todayString(), 'Start date cannot be in the past'),
    endDate: z
      .string()
      .regex(DATE_RE, 'endDate must be in YYYY-MM-DD format')
      .refine(isRealDate, 'endDate must be a real calendar date'),
    pickupTime: z
      .string()
      .regex(TIME_RE, 'pickupTime must be HH:MM in 24-hour format'),
    dropoffTime: z
      .string()
      .regex(TIME_RE, 'dropoffTime must be HH:MM in 24-hour format'),
    message: z
      .string()
      .trim()
      .max(1000, 'Message must be at most 1000 characters')
      .optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

// Honeypot: the "website" field is hidden on the form, so no human fills it.
// If it has any value it is almost certainly a bot: return a fake success
// and save nothing.
function isHoneypot(body) {
  return (
    !!body &&
    typeof body === 'object' &&
    !!body.website &&
    String(body.website).trim() !== ''
  );
}

// POST /api/enquiries
async function createEnquiry(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (isHoneypot(body)) {
      // Look exactly like a real success so the bot cannot tell.
      // Bots trigger nothing: no save, no email.
      return res.status(201).json({
        id: Math.floor(Math.random() * 90000) + 1,
        message: 'Enquiry received',
      });
    }

    const parsed = enquiryBodySchema.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({ error: 'Validation failed', fields });
    }
    const data = parsed.data;

    // The number must have been verified by SMS code (when Firebase is set
    // up). The browser sends Firebase's proof as phoneToken.
    if (phoneToken.isEnabled()) {
      let verified;
      try {
        verified = await phoneToken.verifyPhoneToken(body.phoneToken);
      } catch (err) {
        if (!(err instanceof phoneToken.PhoneTokenError)) throw err;
        return res.status(400).json({ error: 'Validation failed', fields: { phoneToken: err.message } });
      }
      if (!phoneToken.samePhone(verified, data.phone)) {
        return res.status(400).json({
          error: 'Validation failed',
          fields: { phoneToken: 'The number you verified is different from the one in the form. Please verify it again' },
        });
      }
    }

    // If a car was chosen, it must actually exist
    let car = null;
    if (data.carId != null) {
      car = await carsModel.getCarById(data.carId);
      if (!car) {
        return res.status(400).json({
          error: 'Validation failed',
          fields: { carId: 'Car does not exist' },
        });
      }
    }

    const saved = await enquiriesModel.createEnquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      carId: data.carId ?? null,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      startDate: data.startDate,
      endDate: data.endDate,
      pickupTime: data.pickupTime,
      dropoffTime: data.dropoffTime,
      message: data.message || null,
    });

    // Tell the site owner about the new enquiry WITHOUT making the customer
    // wait: this is deliberately NOT awaited, and notifyNewEnquiry() handles
    // all of its own errors, so email problems can never fail the enquiry.
    notifyNewEnquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      carId: data.carId ?? null,
      carName: car ? car.name : null,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      startDate: data.startDate,
      endDate: data.endDate,
      pickupTime: data.pickupTime,
      dropoffTime: data.dropoffTime,
      message: data.message || null,
    });

    res.status(201).json({ id: saved.id, message: 'Enquiry received' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createEnquiry, NAME_RE, PHONE_RE, isRealDate };
