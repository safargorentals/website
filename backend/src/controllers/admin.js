const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const env = require('../config/env');
const adminsModel = require('../models/admins');
const carsModel = require('../models/cars');
const enquiriesModel = require('../models/enquiries');

const loginBodySchema = z.object({
  email: z.string().trim().email('Must be a valid email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(200, 'Password is too long'),
});

// A real bcrypt hash of a random string. When the email does not exist we
// compare against THIS, so both outcomes take the same amount of time and
// the response speed cannot be used to learn which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 12);

// POST /api/admin/login
async function login(req, res, next) {
  try {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({ error: 'Validation failed', fields });
    }
    const { email, password } = parsed.data;

    const admin = await adminsModel.getAdminByEmail(email);

    // Always run exactly one bcrypt compare, whether or not the admin
    // exists. Unknown email and wrong password are indistinguishable.
    const passwordOk = admin
      ? await bcrypt.compare(password, admin.password_hash)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!admin || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign a JWT holding ONLY the admin id, valid for 8 hours,
    // and send it as an httpOnly cookie - never in the JSON body.
    const token = jwt.sign({ id: admin.id }, env.jwtSecret, {
      expiresIn: env.tokenTtlSeconds,
    });
    res.cookie(env.cookieOptions.name, token, env.cookieOptions);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/logout (requires a valid session)
function logout(req, res) {
  res.clearCookie(env.cookieOptions.name, env.cookieOptions);
  res.json({ ok: true });
}

// GET /api/admin/me (requires a valid session)
function me(req, res) {
  res.json({ ok: true, email: req.admin.email });
}

// GET /api/admin/stats (requires a valid session)
// One dashboard payload: new + total enquiries, car totals.
async function stats(req, res, next) {
  try {
    const [enquiryStats, carStats] = await Promise.all([
      enquiriesModel.getEnquiryStats(),
      carsModel.getCarStats(),
    ]);
    res.json({
      newEnquiries: enquiryStats.new,
      totalEnquiries: enquiryStats.total,
      totalCars: carStats.total,
      availableCars: carStats.available,
      featuredCars: carStats.featured,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, stats };
