// backend/routes/tokenRoutes.js
// SECURITY FIX (CRIT-2): Added authenticate middleware.
// Previously this endpoint accepted memberId from request body with zero auth.
// Now it derives userId from the verified JWT and scopes the update to that user's records only.

const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

/**
 * POST /api/save-token
 * Save or update FCM push token for the authenticated user.
 * SECURITY: Requires valid JWT. Scoped to req.user.id — callers cannot update other users' tokens.
 */
router.post("/save-token", authenticate, async (req, res) => {
  try {
    const { fcmToken } = req.body; // memberId removed — derive identity from JWT
    const userId = req.user.id;

    if (!fcmToken || typeof fcmToken !== "string" || !fcmToken.trim()) {
      return res.status(400).json({ error: "fcmToken is required" });
    }

    // Validate Expo push token format (ExponentPushToken[xxx]) or FCM token format
    const isExpoToken = /^ExponentPushToken\[.+\]$/.test(fcmToken);
    const isFcmToken = fcmToken.length >= 100; // FCM tokens are long strings
    if (!isExpoToken && !isFcmToken) {
      return res.status(400).json({ error: "Invalid push token format" });
    }

    // Update ALL member records owned by this user (scoped — cannot touch other users)
    await prisma.member.updateMany({
      where: { userId: userId },
      data: { fcmToken: fcmToken.trim() },
    });

    res.json({ success: true, message: "FCM token saved" });
  } catch (error) {
    console.error("Error saving FCM token:", error.message);
    res.status(500).json({ error: "Server error while saving token" });
  }
});

module.exports = router;