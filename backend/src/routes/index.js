const { Router } = require('express');
const healthRouter = require('./health');
const carsRouter = require('./cars');

// This is the single router mounted at /api in server.js.
// As the API grows, add new routers here, e.g. router.use('/enquiries', enquiryRouter).
const router = Router();

router.use('/health', healthRouter);
router.use('/cars', carsRouter);

module.exports = router;
