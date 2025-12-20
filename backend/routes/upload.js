// backend/routes/upload.js
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Storage Engine (Enhanced for Audio, Video, PDF)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine the resource type based on mimetype
    let resourceType = 'image'; // Default
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');
    const isPdf = file.mimetype === 'application/pdf';

    if (isVideo || isAudio) {
      resourceType = 'video'; // Cloudinary handles audio under 'video'
    } else if (isPdf) {
      resourceType = 'raw';   // Use 'raw' for documents to prevent conversion issues
    }

    // Determine folder based on context set in query string (e.g. ?context=dating)
    const context = req.query.context === 'dating' ? 'dating' : 'chat';
    const folderName = `community_talk_${context}_uploads`;

    return {
      folder: folderName,
      resource_type: resourceType,
      public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
      // For raw files (PDFs), we want to keep the original extension
      format: isPdf ? 'pdf' : undefined,
    };
  },
});

// 3. Validation Middleware
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime',
    // Documents
    'application/pdf',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/aac'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: Images, Videos, PDFs, Audio.'), false);
  }
};

// Initialize Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max limit
  },
  fileFilter: fileFilter
});

// 4. Secure Upload Route
router.post('/', (req, res, next) => {
  console.log('🔍 [UPLOAD] Request received');
  console.log('Headers:', req.headers);
  console.log('Body type:', typeof req.body);
  next();
}, upload.single('file'), (req, res) => {
  try {
    console.log('📥 [UPLOAD] After multer - req.file:', req.file ? 'EXISTS' : 'NULL');
    if (!req.file) {
      console.log('❌ [UPLOAD] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Determine the simplified type for the frontend
    let frontendType = 'file';
    if (req.file.mimetype.startsWith('image/')) frontendType = 'photo';
    else if (req.file.mimetype.startsWith('video/')) frontendType = 'video';
    else if (req.file.mimetype.startsWith('audio/')) frontendType = 'audio';
    else if (req.file.mimetype === 'application/pdf') frontendType = 'file';

    // Prepare metadata matching your Message/DirectMessage Schema
    const attachmentData = {
      url: req.file.path || req.file.secure_url, // Cloudinary URL
      type: frontendType,
      name: req.file.originalname,
      size: req.file.size,
      publicId: req.file.filename
    };

    console.log(`✅ File uploaded (${frontendType}):`, attachmentData.name);
    res.json(attachmentData);

  } catch (error) {
    console.error('❌ Upload Processing Error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Import ImageKit service
const { uploadToImageKit } = require("../services/imagekitService");

/**
 * POST /api/upload/base64
 * Uploads a base64 image (used for Dating Photos to avoid FormData issues on RN)
 * Uses ImageKit (same as User Avatar)
 */
router.post('/base64', async (req, res) => {
  try {
    const { image, fileName, folder } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    const name = fileName || `upload_${Date.now()}.jpg`;

    // Upload to Cloudinary (Base64)
    // Cloudinary supports base64 directly: "data:image/jpeg;base64,..."
    // or just the raw base64 string if configured? Usually needs data URI scheme.

    // Ensure data URI
    let fileStr = image;
    if (!fileStr.startsWith('data:')) {
      // Guess mime type or default to jpeg?
      // Ideally frontend sends full data URI. 
      // If just base64, assume jpeg for now or try to detect.
      fileStr = `data:image/jpeg;base64,${image}`;
    }

    // Determine folder from context if not provided
    const contextParam = req.query.context === 'dating' ? 'dating' : 'chat';
    const defaultFolder = `community_talk_${contextParam}_uploads`;

    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: folder || defaultFolder,
      resource_type: "auto", // Handle video/image automatically
      public_id: `${Date.now()}-${path.parse(fileName || 'upload').name}`,
    });

    if (!uploadResponse || !uploadResponse.secure_url) {
      throw new Error("Failed to get download URL from Cloudinary");
    }

    console.log(`✅ Base64 File uploaded via Cloudinary:`, name);

    // Determine type
    let type = 'file';
    if (uploadResponse.resource_type === 'image') type = 'photo';
    if (uploadResponse.resource_type === 'video') type = 'video';

    return res.json({
      url: uploadResponse.secure_url,
      type: type,
      name: name,
      fileId: uploadResponse.public_id
    });

  } catch (error) {
    console.error("❌ Base64 Upload Error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// Error handling for Multer (Size limits, file types)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Max 100MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;