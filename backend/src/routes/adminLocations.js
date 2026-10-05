const { Router } = require('express');
const adminLocationsController = require('../controllers/adminLocations');
const requireAdmin = require('../middleware/requireAdmin');

const router = Router();

// Everything here needs an admin session
router.use(requireAdmin);

router.get('/', adminLocationsController.listAdminLocations);
router.post('/', adminLocationsController.createAdminLocation);
// /order must be registered BEFORE /:id, or "order" would be read as an id
router.put('/order', adminLocationsController.reorderAdminLocations);
router.put('/:id', adminLocationsController.updateAdminLocation);
router.delete('/:id', adminLocationsController.deleteAdminLocation);

module.exports = router;
