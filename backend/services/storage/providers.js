// backend/services/storage/providers.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

/**
 * Base Class to ensure all providers follow the same rules
 */
class StorageProvider {
  constructor() {
    if (this.constructor === StorageProvider) {
      throw new Error("Abstract class 'StorageProvider' cannot be instantiated directly.");
    }
  }

  getMulterStorage() { throw new Error("Method 'getMulterStorage()' must be implemented."); }
  
  // Normalize the file object returned by Multer so the controller doesn't care which provider was used
  normalizeFile(file) { throw new Error("Method 'normalizeFile()' must be implemented."); }
}

/**
 * ✅ 1. Cloudinary Implementation (Current)
 */
class CloudinaryProvider extends StorageProvider {
  constructor() {
    super();
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  getMulterStorage() {
    return new CloudinaryStorage({
      cloudinary: cloudinary,
      params: async (req, file) => {
        const isVideo = file.mimetype.startsWith('video/');
        return {
          folder: 'community_talk_uploads',
          resource_type: isVideo ? 'video' : 'image',
          public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
        };
      },
    });
  }

  normalizeFile(file) {
    return {
      url: file.path, // Cloudinary uses 'path' for the URL
      provider: 'cloudinary',
      key: file.filename, // The unique ID in Cloudinary
      mimetype: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    };
  }
}

/**
 * 🚀 2. AWS S3 Implementation (Future Proofing)
 * To migrate later: Install 'multer-s3' & '@aws-sdk/client-s3', set ENV vars, and that's it!
 */
class S3Provider extends StorageProvider {
  constructor() {
    super();
    // Lazy load dependencies so the app doesn't crash if they aren't installed yet
    try {
      this.S3Client = require('@aws-sdk/client-s3').S3Client;
      this.multerS3 = require('multer-s3');
    } catch (e) {
      console.error("❌ To use S3, run: npm install @aws-sdk/client-s3 multer-s3");
      throw e;
    }

    this.s3 = new this.S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  getMulterStorage() {
    return this.multerS3({
      s3: this.s3,
      bucket: process.env.AWS_BUCKET_NAME,
      contentType: this.multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${path.basename(file.originalname)}`;
        cb(null, `community_talk_uploads/${uniqueName}`);
      },
    });
  }

  normalizeFile(file) {
    return {
      url: file.location, // S3 uses 'location' for the URL
      provider: 's3',
      key: file.key, // S3 uses 'key'
      mimetype: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    };
  }
}

module.exports = { CloudinaryProvider, S3Provider };