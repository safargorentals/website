const { Router } = require('express');
const healthController = require('../controllers/health');

const router = Router();

// GET /api/health
router.get('/', healthController.check);

module.exports = router;
