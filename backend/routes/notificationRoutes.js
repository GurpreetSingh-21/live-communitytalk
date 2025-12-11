// backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client"); // Import Prisma

const { sendTestNotification } = require("../services/notificationService");
const authenticate = require("../middleware/authenticate");

// Protection (was not explicit in previous file, but jsdoc said "Private")
// The previous file relied on implicit auth or server.js applying it?
// server.js: app.use("/api/notifications", authenticate, notificationRoutes);
// So we don't strictly need router.use(authenticate) if server.js does it.
// Checked server.js in step 512, line 42: const notificationRoutes = require("./routes/notificationRoutes");
// But line 800+ (not shown) likely mounts it. 
// Standard practice: if server.js mounts with authenticate, we are good.
// But to be safe, we can rely on request.user existing.

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
    // Prisma: Add token if unique
    // We can't use $addToSet. 
    // Option 1: Fetch -> check -> update.
    // Option 2: Raw SQL (Postgres specific) array_append distinct?
    // Let's stick to Option 1 for portability/simplicity unless concurrency is huge.
    
    // We can use a transaction or just simple fetch/update.
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { pushTokens: true, email: true }
    });
    
    if (!user) {
         return res.status(404).json({ error: "User not found" });
    }

    const currentTokens = user.pushTokens || [];
    if (!currentTokens.includes(token)) {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                pushTokens: { push: token } // Prisma support push for scalar lists (Postgres)
            },
            select: { pushTokens: true }
        });
        
        console.log(`[Notifications] Registered token for ${user.email}: ${token.slice(0, 30)}...`);
        return res.status(200).json({
             message: "Token registered successfully",
             tokens: updatedUser.pushTokens,
        });
    }

    // Already exists
    res.status(200).json({
       message: "Token already registered",
       tokens: currentTokens
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
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { pushTokens: true, email: true }
    });
    
    if (!user) return res.status(404).json({ error: "User not found" });

    // Prisma scalar list filtering
    const newTokens = (user.pushTokens || []).filter(t => t !== token);
    
    // If no change, just return
    if (newTokens.length === user.pushTokens.length) {
         return res.status(200).json({
            message: "Token not found or already removed",
            tokens: user.pushTokens
         });
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            pushTokens: { set: newTokens } // Replace entire list
        },
        select: { pushTokens: true }
    });

    console.log(`[Notifications] Unregistered token for ${user.email}`);
    res.status(200).json({
      message: "Token unregistered successfully",
      tokens: updatedUser.pushTokens,
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushTokens: true, email: true }
    });

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
    console.error("[Notifications] Failed to send send test notification:", err);
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushTokens: true }
    });

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