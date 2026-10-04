const { Router } = require('express');
const carTypesController = require('../controllers/carTypes');

const router = Router();

router.get('/', carTypesController.listCarTypes);

module.exports = router;
