const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

// mimetype -> real type. Multer checks the mimetype first (fast reject);
// the controller then re-checks the file's actual bytes, because browsers
// can lie about mimetypes and file extensions.
const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Read the file's real type from its first bytes (magic bytes).
// JPEG starts with FF D8 FF, PNG with 89 50 4E 47 0D 0A 1A 0A,
// WebP is a RIFF container whose bytes 8-11 spell WEBP.
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return 'png';
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

// POST /api/admin/uploads
async function uploadCarImages(req, res, next) {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
      return res.status(503).json({ error: 'Image uploads are not configured' });
    }

    // Validate EVERY file before uploading anything, so one bad file
    // cannot leave a half-uploaded set behind.
    // The error never echoes the file name.
    for (const file of files) {
      const claimed = ALLOWED_MIME_TYPES[file.mimetype];
      const actual = detectImageType(file.buffer);
      if (!claimed || !actual || claimed !== actual) {
        return res.status(400).json({
          error: 'Invalid image: only real JPEG, PNG or WebP images are allowed',
        });
      }
    }

    const urls = [];
    for (const file of files) {
      // A random 32-char hex name: the original file name is never used,
      // so it cannot overwrite other files or inject paths.
      const publicId = crypto.randomBytes(16).toString('hex');
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'safargo/cars',
        public_id: publicId,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
        // Strip EXIF/GPS metadata from the stored image (location, camera
        // details) and don't return it in the response.
        strip: true,
        image_metadata: false,
      });
      urls.push(result.secure_url);
    }

    res.json({ urls });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadCarImages, ALLOWED_MIME_TYPES };
