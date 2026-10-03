const { Router } = require('express');
const carsController = require('../controllers/cars');

const router = Router();

// IMPORTANT: /featured must be registered BEFORE /:id,
// otherwise the word "featured" would be treated as a car id.
router.get('/featured', carsController.listFeaturedCars);
router.get('/', carsController.listCars);
router.get('/:id', carsController.getCar);

module.exports = router;
