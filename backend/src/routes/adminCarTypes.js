const { Router } = require('express');
const adminCarTypesController = require('../controllers/adminCarTypes');
const requireAdmin = require('../middleware/requireAdmin');

const router = Router();

// Everything here needs an admin session
router.use(requireAdmin);

router.get('/', adminCarTypesController.listAdminCarTypes);
router.post('/', adminCarTypesController.createAdminCarType);
// /order must be registered BEFORE /:slug, or "order" would be read as a slug
router.put('/order', adminCarTypesController.reorderAdminCarTypes);
router.put('/:slug', adminCarTypesController.updateAdminCarType);
router.delete('/:slug', adminCarTypesController.deleteAdminCarType);

module.exports = router;
