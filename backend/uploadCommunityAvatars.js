/**
 * uploadCommunityAvatars.js
 * 
 * Uploads community avatars to Cloudinary in organized folders:
 *   - community_avatars/countries/  → for country/religion communities
 *   - community_avatars/colleges/   → for college/university communities
 * 
 * Then updates the Community.imageUrl field in the database.
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { PrismaClient } = require('@prisma/client');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Avatar definitions — add more entries here as you grow
// ─────────────────────────────────────────────────────────────────────────────
const AVATARS = [
  {
    localFile: path.join(__dirname, 'community_avatars/countries/india.png'),
    cloudinaryFolder: 'community_avatars/countries',
    publicId: 'india',         // Becomes: community_avatars/countries/india
    // Match communities by name (case-insensitive) or key
    matchBy: { name: 'india' },
  },
  {
    localFile: path.join(__dirname, 'community_avatars/colleges/queens_college.png'),
    cloudinaryFolder: 'community_avatars/colleges',
    publicId: 'queens_college',  // Becomes: community_avatars/colleges/queens_college
    matchBy: { name: 'queens college' },
  },
];

async function uploadAndSetAvatar({ localFile, cloudinaryFolder, publicId, matchBy }) {
  const fullPublicId = `${cloudinaryFolder}/${publicId}`;
  console.log(`\n📤 Uploading: ${localFile}`);
  console.log(`   → Cloudinary folder: ${cloudinaryFolder}`);
  console.log(`   → Public ID: ${fullPublicId}`);

  // 1. Upload to Cloudinary (overwrite if exists)
  const result = await cloudinary.uploader.upload(localFile, {
    folder: cloudinaryFolder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    transformation: [
      { width: 512, height: 512, crop: 'limit' },   // Max 512x512, keep aspect
      { quality: 'auto:best', fetch_format: 'auto' } // Auto WebP/AVIF for modern clients
    ]
  });

  const imageUrl = result.secure_url;
  console.log(`   ✅ Uploaded! URL: ${imageUrl}`);

  // 2. Find and update all matching communities in DB (case-insensitive name search)
  let updatedCount = 0;
  if (matchBy.name) {
    const result = await prisma.community.updateMany({
      where: { name: { contains: matchBy.name, mode: 'insensitive' } },
      data: { imageUrl }
    });
    updatedCount = result.count;
  } else if (matchBy.key) {
    const result = await prisma.community.updateMany({
      where: { key: matchBy.key },
      data: { imageUrl }
    });
    updatedCount = result.count;
  }

  if (updatedCount === 0) {
    console.warn(`   ⚠️  No community found matching: ${JSON.stringify(matchBy)}`);
    return { publicId: fullPublicId, imageUrl, updatedCount: 0 };
  }

  console.log(`   🗃️  DB updated → ${updatedCount} community(s) matching "${matchBy.name || matchBy.key}"`);

  return { publicId: fullPublicId, imageUrl, updatedCount, communityName: matchBy.name || matchBy.key };
}

async function main() {
  console.log('🚀 Community Avatar Upload Script');
  console.log('==================================');
  console.log(`Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

  const results = [];

  for (const avatar of AVATARS) {
    try {
      const result = await uploadAndSetAvatar(avatar);
      results.push({ ...result, success: true });
    } catch (err) {
      console.error(`\n❌ Failed for ${avatar.publicId}:`, err.message);
      results.push({ publicId: avatar.publicId, success: false, error: err.message });
    }
  }

  console.log('\n\n📊 SUMMARY');
  console.log('==========');
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.publicId}`);
      if (r.communityName) console.log(`   Community: "${r.communityName}" (${r.communityId})`);
      console.log(`   URL: ${r.imageUrl}`);
    } else {
      console.log(`❌ ${r.publicId}: ${r.error}`);
    }
  }

  console.log('\n✨ Done! Clear the app cache / pull-to-refresh to see the new avatars.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
