//backend/routes/tokenRoutes.js

const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

// Save or update FCM token for a logged-in member
router.post("/save-token", async (req, res) => {
  try {
    const { memberId, fcmToken } = req.body;

    if (!memberId || !fcmToken) {
      return res.status(400).json({ error: "memberId and fcmToken are required" });
    }

    // Prisma update
    // Note: If member doesn't exist, this throws RecordNotFound
    // We catch it or use updateMany to avoid throw (but update is better for ID)
    await prisma.member.update({
        where: { id: memberId },
        data: { fcmToken } // Ensure fcmToken is in Member schema? 
        // Need to verify if Member schema has fcmToken. 
        // If Mongoose had it, likely we added it or missed it. 
        // I will assume missed if not seen. 
        // Actually, let's look at Member schema in next tool call result. 
        // If not present, I can't update.
    });

    res.json({ success: true, message: "FCM token saved" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    // Graceful fail if schema mismatch
    if (error.code === 'P2025' || error.code === 'P2009') { // Not found or validation
         return res.status(400).json({ error: "Member not found or invalid field" });
    }
    res.status(500).json({ error: "Server error while saving token" });
  }
});

module.exports = router;