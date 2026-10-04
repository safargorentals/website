const jwt = require('jsonwebtoken');
const env = require('../config/env');
const adminsModel = require('../models/admins');

// Protects every /api/admin/* route except /login.
// A request passes only if it carries a valid, unexpired admin_token cookie
// AND the admin that id points to still exists in the database.
// On any failure it answers 401 - and never says which step failed.
async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[env.cookieOptions.name] : undefined;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload;
    try {
      // The algorithm is pinned: only HS256 tokens are accepted, so a token
      // claiming any other algorithm (or "none") is rejected outright.
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      // Bad signature, expired, or malformed - all the same to the client
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!payload || typeof payload !== 'object' || !Number.isInteger(payload.id)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // The admin must still exist (the account may have been deleted)
    const admin = await adminsModel.getAdminById(payload.id);
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attaching the admin to the request lets controllers use it directly
    req.admin = admin;
    next();
  } catch (err) {
    // Unexpected error - fail closed, leak nothing
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = requireAdmin;
