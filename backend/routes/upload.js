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

// HIGH-6 SECURITY FIX: Storage Engine — explicit resource_type, never 'auto'
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // HIGH-6: Explicitly determine resource_type — never use 'auto'
    // 'auto' allows Cloudinary to serve attacker-controlled HTML as text/html (stored XSS)
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');
    const isPdf = file.mimetype === 'application/pdf';

    let resourceType = 'image'; // Default
    if (isVideo || isAudio) {
      resourceType = 'video'; // Cloudinary handles audio under 'video'
    } else if (isPdf) {
      resourceType = 'raw';   // Use 'raw' for documents
    }

    // Determine folder based on context query param (e.g. ?context=dating)
    const context = req.query.context === 'dating' ? 'dating' : 'chat';
    const folderName = `community_talk_${context}_uploads`;

    // Sanitize original filename to prevent path traversal
    const safeName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
      folder: folderName,
      resource_type: resourceType, // SECURITY: explicit, never 'auto'
      public_id: `${Date.now()}-${safeName}`,
      format: isPdf ? 'pdf' : undefined,
    };
  },
});

// HIGH-6 SECURITY FIX: Validation Middleware
// Note: file.mimetype comes from the client Content-Type — not trustworthy alone.
// We explicitly block dangerous types even if they pass the allowlist check.
const fileFilter = (req, file, cb) => {
  // SECURITY: Explicit blocklist for types that can execute in a browser
  const blockedMimes = [
    'image/svg+xml',          // SVG can contain embedded JavaScript
    'text/html',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
    'application/xhtml+xml',
    'application/xml',
    'text/xml',
  ];

  if (blockedMimes.includes(file.mimetype)) {
    return cb(new Error('File type not allowed for security reasons.'), false);
  }

  const allowedMimes = [
    // Images — SVG intentionally excluded (can embed JS)
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime',
    // Documents
    'application/pdf',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/aac',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: Images (jpg/png/gif/webp), Videos, PDFs, Audio.'), false);
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
  if (process.env.NODE_ENV !== 'production') console.log('🔍 [UPLOAD] Request received');
  next();
}, upload.single('file'), (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') console.log('📥 [UPLOAD] After multer - req.file:', req.file ? 'EXISTS' : 'NULL');
    if (!req.file) {
      if (process.env.NODE_ENV !== 'production') console.log('❌ [UPLOAD] No file in request');
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

    if (process.env.NODE_ENV !== 'production') console.log(`✅ File uploaded (${frontendType}):`, attachmentData.name);
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
// CRIT-3 SECURITY FIX: base64 upload now validates MIME type and uses explicit resource_type
router.post('/base64', async (req, res) => {
  try {
    const { image, fileName, folder } = req.body;

    // Defence-in-depth auth check (router is already mounted behind authenticate in server.js)
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: "No image data provided" });
    }

    // Size guard: reject base64 payloads over 10MB (decoded size)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    if (Buffer.byteLength(base64Data, 'base64') > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: "Image too large. Max 10MB." });
    }

    // CRIT-3 FIX: Validate MIME type from data URI before sending to Cloudinary
    // This prevents uploading HTML/JS/SVG files that Cloudinary would serve publicly
    let fileStr = image;
    let detectedMime = null;

    if (fileStr.startsWith('data:')) {
      // Extract MIME from data URI: data:<mime>;base64,<data>
      const dataUriMatch = fileStr.match(/^data:([a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]+\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]+);base64,/);
      if (!dataUriMatch) {
        return res.status(400).json({ error: "Invalid data URI format" });
      }
      detectedMime = dataUriMatch[1].toLowerCase();
    } else {
      // Raw base64 without data URI — assume jpeg (safest default)
      detectedMime = 'image/jpeg';
      fileStr = `data:image/jpeg;base64,${image}`;
    }

    // CRIT-3: Strict allowlist — only image types for base64 uploads
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    // Explicitly block dangerous types even if not in allowlist
    const blockedMimes = ['image/svg+xml', 'text/html', 'text/javascript', 'application/javascript', 'application/xhtml+xml'];

    if (blockedMimes.includes(detectedMime)) {
      return res.status(400).json({ error: "File type not allowed for security reasons" });
    }
    if (!allowedImageMimes.includes(detectedMime)) {
      return res.status(400).json({ error: "Invalid image type. Allowed: jpeg, png, gif, webp" });
    }

    // Sanitize fileName to prevent path traversal
    const safeName = (fileName || `upload_${Date.now()}.jpg`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    // Determine folder from context if not provided
    const contextParam = req.query.context === 'dating' ? 'dating' : 'chat';
    const defaultFolder = `community_talk_${contextParam}_uploads`;
    // Validate user-supplied folder doesn't escape intended directory
    const safeFolder = folder && /^[a-zA-Z0-9_/-]+$/.test(folder) ? folder : defaultFolder;

    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: safeFolder,
      resource_type: 'image', // CRIT-3 FIX: explicit 'image', never 'auto'
      public_id: `${Date.now()}-${path.parse(safeName).name}`,
    });

    if (!uploadResponse?.secure_url) {
      throw new Error("Failed to get download URL from Cloudinary");
    }

    return res.json({
      url: uploadResponse.secure_url,
      type: 'photo',
      name: safeName,
      fileId: uploadResponse.public_id,
    });

  } catch (error) {
    console.error("❌ Base64 Upload Error:", error.message);
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