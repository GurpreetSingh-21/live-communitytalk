// backend/services/imagekitService.js
const ImageKit = require("imagekit");

// ── Lazy initialization ────────────────────────────────────────────────────
// ImageKit is initialized on first use rather than at module load time.
// This ensures dotenv has already loaded the .env file (done in server.js)
// before these env vars are read.
let _imagekit = null;

function getImageKit() {
    if (_imagekit) return _imagekit;

    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
        throw new Error(
            "ImageKit credentials missing. Make sure IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are set in your .env file."
        );
    }

    _imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });
    return _imagekit;
}

/**
 * Uploads a file (base64) to ImageKit
 * @param {string} file - Base64 string of the image
 * @param {string} fileName - Desired file name
 * @param {string} folder - Folder in ImageKit (optional)
 */
async function uploadToImageKit(file, fileName, folder = "avatars") {
    try {
        const response = await getImageKit().upload({
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

function getAuthenticationParameters() {
    return getImageKit().getAuthenticationParameters();
}

module.exports = { uploadToImageKit, getAuthenticationParameters };