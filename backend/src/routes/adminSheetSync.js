const { Router } = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { getSheetSyncStatus, runSheetSync } = require('../controllers/adminSheetSync');

const router = Router();

router.get('/', requireAdmin, getSheetSyncStatus);
router.post('/', requireAdmin, runSheetSync);

module.exports = router;
