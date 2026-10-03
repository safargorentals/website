const { Router } = require('express');
const adminCarsController = require('../controllers/adminCars');
const requireAdmin = require('../middleware/requireAdmin');

const router = Router();

// One guard for the whole router: everything below needs an admin session,
// so no route can accidentally be left unprotected.
router.use(requireAdmin);

router.get('/', adminCarsController.listAdminCars);
router.post('/', adminCarsController.createAdminCar);
router.get('/:id', adminCarsController.getAdminCar);
router.put('/:id', adminCarsController.updateAdminCar);
router.patch('/:id/price', adminCarsController.updateAdminCarPrice);
router.patch('/:id/featured', adminCarsController.setAdminCarFeatured);
router.delete('/:id', adminCarsController.deleteAdminCar);

module.exports = router;
