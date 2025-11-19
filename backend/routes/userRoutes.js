// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const Person = require("../person"); // Your Person model
const Member = require("../models/Member"); // ✅ Import Member model for sync
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

    // 1. Prepare file name (e.g., avatar_USERID_TIMESTAMP.jpg)
    const fileName = `avatar_${userId}_${Date.now()}.${fileExtension || "jpg"}`;

    // 2. Upload to ImageKit
    // Note: imageData should be the base64 string
    const uploadResponse = await uploadToImageKit(imageData, fileName);

    if (!uploadResponse || !uploadResponse.url) {
      throw new Error("Failed to get download URL from ImageKit");
    }

    // 3. Update User in Person Collection (Source of Truth)
    const updatedUser = await Person.findByIdAndUpdate(
      userId,
      { avatar: uploadResponse.url },
      { new: true }
    ).select("-password"); // Return user info but exclude password

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4. ✅ SYNC: Update all Membership records for this user in Member Collection
    // This ensures the new avatar appears immediately in community member lists
    await Member.updateMany(
      { person: userId },
      { $set: { avatar: uploadResponse.url } }
    );

    return res.json({
      message: "Avatar updated successfully",
      avatar: updatedUser.avatar,
      user: updatedUser,
    });

  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ error: "Server error uploading avatar" });
  }
});

module.exports = router;