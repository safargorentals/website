const { Router } = require('express');
const locationsController = require('../controllers/locations');

const router = Router();

router.get('/', locationsController.listLocations);

module.exports = router;
