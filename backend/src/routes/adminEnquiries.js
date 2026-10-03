const { Router } = require('express');
const adminEnquiriesController = require('../controllers/adminEnquiries');
const requireAdmin = require('../middleware/requireAdmin');

const router = Router();

// One guard for the whole router: everything below needs an admin session,
// so no route can accidentally be left unprotected.
router.use(requireAdmin);

// IMPORTANT: /stats must be registered BEFORE /:id,
// otherwise the word "stats" would be treated as an enquiry id.
router.get('/stats', adminEnquiriesController.getEnquiryStats);
router.get('/', adminEnquiriesController.listEnquiries);
router.get('/:id', adminEnquiriesController.getEnquiry);
router.patch('/:id', adminEnquiriesController.updateEnquiry);
router.delete('/:id', adminEnquiriesController.deleteEnquiry);

module.exports = router;
