const { Router } = require('express');
const healthRouter = require('./health');
const carsRouter = require('./cars');
const enquiriesRouter = require('./enquiries');
const adminRouter = require('./admin');
const adminCarsRouter = require('./adminCars');
const adminUploadsRouter = require('./adminUploads');

// This is the single router mounted at /api in server.js.
// As the API grows, add new routers here, e.g. router.use('/enquiries', enquiryRouter).
const router = Router();

router.use('/health', healthRouter);
router.use('/cars', carsRouter);
router.use('/enquiries', enquiriesRouter);
router.use('/admin', adminRouter);
router.use('/admin/cars', adminCarsRouter);
router.use('/admin/uploads', adminUploadsRouter);

module.exports = router;
