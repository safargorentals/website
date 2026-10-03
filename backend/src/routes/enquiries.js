const { Router } = require('express');
const enquiriesController = require('../controllers/enquiries');
const enquiryLimiter = require('../middleware/enquiryLimiter');

const router = Router();

// The strict 5-per-hour limiter applies to this route only.
router.post('/', enquiryLimiter, enquiriesController.createEnquiry);

module.exports = router;
