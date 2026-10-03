const { Router } = require('express');
const adminController = require('../controllers/admin');
const requireAdmin = require('../middleware/requireAdmin');
const loginLimiter = require('../middleware/loginLimiter');

const router = Router();

// Login is the only admin route that does not need an existing session.
router.post('/login', loginLimiter, adminController.login);

// Everything else needs a valid admin session (requireAdmin).
router.post('/logout', requireAdmin, adminController.logout);
router.get('/me', requireAdmin, adminController.me);

module.exports = router;
