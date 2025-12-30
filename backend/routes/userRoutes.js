// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { uploadToImageKit } = require("../services/imagekitService");
const authenticate = require("../middleware/authenticate");

// Protect all routes in this file
router.use(authenticate);

/**
 * POST /api/user/avatar
 * Uploads a new profile picture and updates the user's record.
 */
router.post("/avatar", async (req, res) => {
  try {
    const { imageData, fileExtension } = req.body;
    const userId = req.user.id;

    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // 1. Prepare file name
    const fileName = `avatar_${userId}_${Date.now()}.${fileExtension || "jpg"}`;

    // 2. Upload to ImageKit
    const uploadResponse = await uploadToImageKit(imageData, fileName);

    if (!uploadResponse || !uploadResponse.url) {
      throw new Error("Failed to get download URL from ImageKit");
    }

    // 3. Update User in DB
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: uploadResponse.url },
    });

    // 4. SYNC: Update all Membership records for this user
    try {
      await prisma.member.updateMany({
        where: { userId: userId },
        data: { avatar: uploadResponse.url }
      });
    } catch (syncErr) {
      console.warn("Avatar sync warning:", syncErr);
    }

    // Return user info excluding sensitive data
    const safeUser = {
      id: updatedUser.id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      collegeSlug: updatedUser.collegeSlug,
      religionKey: updatedUser.religionKey,
      bio: updatedUser.bio
    };

    return res.json({
      message: "Avatar updated successfully",
      avatar: updatedUser.avatar,
      user: safeUser,
    });

  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ error: "Server error uploading avatar" });
  }
});

/**
 * GET /api/user/:id
 * Fetch user profile by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        email: true,
        collegeSlug: true,
        religionKey: true,
        bio: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Rename id -> _id if frontend expects it (legacy compatibility)
    // Actually, let's keep it consistant with other routes which return _id for now
    // But moving forward we should prefer id. 
    // Mongoose usually returned _id.
    const responseUser = {
      _id: user.id, // Legacy compat
      ...user
    };

    return res.json(responseUser);
  } catch (err) {
    console.error("[User Routes] GET error:", err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ───────────────────────── E2EE Public Key Endpoints ─────────────────────────

/**
 * PUT /api/user/publicKey
 * Upload/update the user's E2EE public key
 */
router.put("/publicKey", async (req, res) => {
  try {
    const userId = req.user.id;
    const { publicKey } = req.body;

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: "publicKey is required" });
    }

    // Basic validation: Base64 encoded X25519 public key should be ~44 chars
    if (publicKey.length < 40 || publicKey.length > 50) {
      return res.status(400).json({ error: "Invalid publicKey format" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { publicKey }
    });

    console.log(`🔐 [E2EE] User ${userId} uploaded public key`);
    return res.json({ success: true, message: "Public key saved" });
  } catch (err) {
    console.error("[User Routes] PUT publicKey error:", err);
    return res.status(500).json({ error: "Failed to save public key" });
  }
});

/**
 * GET /api/user/:id/publicKey
 * Fetch a user's E2EE public key for encrypting messages to them
 */
router.get("/:id/publicKey", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, publicKey: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.publicKey) {
      return res.status(404).json({ error: "User has no public key" });
    }

    return res.json({ publicKey: user.publicKey });
  } catch (err) {
    console.error("[User Routes] GET publicKey error:", err);
    return res.status(500).json({ error: "Failed to fetch public key" });
  }
});

module.exports = router;