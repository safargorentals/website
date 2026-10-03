const multer = require('multer');
const { Router } = require('express');
const { uploadCarImages, ALLOWED_MIME_TYPES } = require('../controllers/adminUploads');
const requireAdmin = require('../middleware/requireAdmin');
const uploadLimiter = require('../middleware/uploadLimiter');

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const MAX_FILES = 5;

const upload = multer({
  // Memory storage: files live in RAM as buffers, nothing is written to disk
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (!Object.hasOwn(ALLOWED_MIME_TYPES, file.mimetype)) {
      const err = new Error('Only JPEG, PNG and WebP images are allowed');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const router = Router();

// requireAdmin runs first, so only signed-in admins count toward the limit
router.post(
  '/',
  requireAdmin,
  uploadLimiter,
  upload.array('images', MAX_FILES),
  uploadCarImages
);

module.exports = router;
