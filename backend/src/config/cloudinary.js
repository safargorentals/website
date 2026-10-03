const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

// The credentials come only from the environment (via src/config/env.js).
// Nothing secret is written in this file.
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

module.exports = cloudinary;
