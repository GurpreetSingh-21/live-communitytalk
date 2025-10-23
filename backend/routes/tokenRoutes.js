//backend/routes/tokenRoutes.js

const express = require("express");
const router = express.Router();
const Member = require("../models/Member");

// Save or update FCM token for a logged-in member
router.post("/save-token", async (req, res) => {
  try {
    const { memberId, fcmToken } = req.body;

    if (!memberId || !fcmToken) {
      return res.status(400).json({ error: "memberId and fcmToken are required" });
    }

    await Member.findByIdAndUpdate(memberId, { fcmToken });
    res.json({ success: true, message: "FCM token saved" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    res.status(500).json({ error: "Server error while saving token" });
  }
});

module.exports = router;