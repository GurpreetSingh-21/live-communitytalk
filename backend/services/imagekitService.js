// backend/services/imagekitService.js
const ImageKit = require("imagekit");
require("dotenv").config();

// Initialize ImageKit with credentials from .env
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/**
 * Uploads a file (base64) to ImageKit
 * @param {string} file - Base64 string of the image
 * @param {string} fileName - Desired file name
 * @param {string} folder - Folder in ImageKit (optional)
 */
async function uploadToImageKit(file, fileName, folder = "avatars") {
  try {
    const response = await imagekit.upload({
      file: file, // Base64 string from frontend
      fileName: fileName,
      folder: folder,
      tags: ["profile_picture"],
    });
    return response;
  } catch (error) {
    console.error("❌ ImageKit Upload Error:", error);
    throw error;
  }
}

module.exports = { uploadToImageKit };