const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deleteCloudinaryAsset = async (url) => {
  try {
    if (!url) return;
    const u = new URL(url);
    if (!['res.cloudinary.com'].includes(u.hostname)) return;

    const parts = url.split('/upload/');
    if (parts.length > 1) {
      let pathSegments = parts[1].split('/');
      if (pathSegments[0].match(/^v\d+$/)) {
        pathSegments.shift();
      }
      let publicIdWithExt = pathSegments.join('/');
      let publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.')) || publicIdWithExt;
      
      await cloudinary.uploader.destroy(publicId);
      console.log('✅ Deleted Cloudinary asset:', publicId);
    }
  } catch(e) {
    console.error('Failed to delete asset from Cloudinary:', e);
  }
};

module.exports = { deleteCloudinaryAsset, cloudinary };
