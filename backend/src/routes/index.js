const { Router } = require('express');
const healthRouter = require('./health');
const carsRouter = require('./cars');
const carTypesRouter = require('./carTypes');
const enquiriesRouter = require('./enquiries');
const adminRouter = require('./admin');
const adminCarsRouter = require('./adminCars');
const adminCarTypesRouter = require('./adminCarTypes');
const adminUploadsRouter = require('./adminUploads');
const adminEnquiriesRouter = require('./adminEnquiries');

// This is the single router mounted at /api in server.js.
// As the API grows, add new routers here, e.g. router.use('/enquiries', enquiryRouter).
const router = Router();

router.use('/health', healthRouter);
router.use('/cars', carsRouter);
router.use('/car-types', carTypesRouter);
router.use('/enquiries', enquiriesRouter);
router.use('/admin', adminRouter);
router.use('/admin/cars', adminCarsRouter);
router.use('/admin/car-types', adminCarTypesRouter);
router.use('/admin/uploads', adminUploadsRouter);
router.use('/admin/enquiries', adminEnquiriesRouter);

module.exports = router;
