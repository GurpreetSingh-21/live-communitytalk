// backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const Person = require("../person");
const { sendTestNotification } = require("../services/notificationService");

/**
 * @route   POST /api/notifications/register
 * @desc    Register an Expo push token for the authenticated user
 * @access  Private (requires authentication)
 */
router.post("/register", async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id; // From 'authenticate' middleware

  if (!token) {
    return res.status(400).json({ error: "Push token is required" });
  }

  try {
    // Find the user and add the new token to their list if it's not already there
    // We use $addToSet to automatically prevent duplicates
    const user = await Person.findByIdAndUpdate(
      userId,
      { $addToSet: { pushTokens: token } },
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Notifications] Registered token for ${user.email}: ${token.slice(0, 30)}...`);
    res.status(200).json({
      message: "Token registered successfully",
      tokens: user.pushTokens, // Send back the new list
    });
  } catch (err) {
    console.error("[Notifications] Failed to register push token:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   POST /api/notifications/unregister
 * @desc    Remove an Expo push token for the authenticated user
 * @access  Private (requires authentication)
 */
router.post("/unregister", async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) {
    return res.status(400).json({ error: "Push token is required" });
  }

  try {
    const user = await Person.findByIdAndUpdate(
      userId,
      { $pull: { pushTokens: token } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Notifications] Unregistered token for ${user.email}`);
    res.status(200).json({
      message: "Token unregistered successfully",
      tokens: user.pushTokens,
    });
  } catch (err) {
    console.error("[Notifications] Failed to unregister push token:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification to the authenticated user
 * @access  Private (requires authentication)
 */
router.post("/test", async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await Person.findById(userId).select("pushTokens email").lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.pushTokens || user.pushTokens.length === 0) {
      return res.status(404).json({ error: "No push tokens found for this user." });
    }

    console.log(`[Notifications] Sending test to ${user.email} with ${user.pushTokens.length} token(s)`);

    // Use the notification service
    const result = await sendTestNotification(user);

    res.status(200).json({
      message: `Sent notification. Success: ${result.successCount}, Failure: ${result.failureCount}`,
      result,
    });
  } catch (err) {
    console.error("[Notifications] Failed to send test notification:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * @route   GET /api/notifications/tokens
 * @desc    Get all registered push tokens for the authenticated user
 * @access  Private (requires authentication)
 */
router.get("/tokens", async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await Person.findById(userId).select("pushTokens").lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      tokens: user.pushTokens || [],
      count: (user.pushTokens || []).length,
    });
  } catch (err) {
    console.error("[Notifications] Failed to fetch tokens:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;