// backend/services/storage/index.js
const multer = require('multer');
const { CloudinaryProvider, S3Provider } = require('./providers');

// 1. Determine active provider from .env
const PROVIDER_TYPE = process.env.STORAGE_PROVIDER || 'cloudinary'; 

console.log(`📦 Initializing Storage Provider: ${PROVIDER_TYPE.toUpperCase()}`);

let activeProvider;

switch (PROVIDER_TYPE.toLowerCase()) {
  case 's3':
  case 'aws':
    activeProvider = new S3Provider();
    break;
  case 'cloudinary':
  default:
    activeProvider = new CloudinaryProvider();
    break;
}

// 2. Configure standard Multer limits and filters (applied to ALL providers)
const uploadMiddleware = multer({
  storage: activeProvider.getMulterStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB Global Limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only standard images and videos are allowed.'), false);
    }
  }
});

// 3. Export the middleware and the normalizer
module.exports = {
  upload: uploadMiddleware,
  normalizeFile: (file) => activeProvider.normalizeFile(file),
};