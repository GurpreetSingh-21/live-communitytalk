// backend/routes/twoFactorRoutes.js
const express = require("express");
const router = express.Router();
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");

const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

/* -------------------- Setup 2FA -------------------- */
// POST /api/2fa/setup - Generate secret and QR code
router.post("/setup", async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if enabled
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA is already enabled. Disable it first to set up again." });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CommunityTalk (${user.email})`,
      length: 20 // Default is usually fine, 20 is standard (32 chars in base32)
    });

    // Temporarily store secret (not enabled yet)
    // We update the user with the secret but flag remains false
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32 }
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      message: "2FA secret generated. Scan the QR code with your authenticator app.",
      qrCode: qrCodeUrl,
      secret: secret.base32,
      manualEntry: secret.base32
    });
  } catch (err) {
    console.error("💥 POST /api/2fa/setup ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- Verify and Enable 2FA -------------------- */
// POST /api/2fa/verify-setup - Verify code and enable 2FA
router.post("/verify-setup", async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Verification code is required" });
    }

    // Retrieve secret
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA setup not initiated. Call /setup first." });
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const c = Math.random().toString(36).substring(2, 10).toUpperCase();
      backupCodes.push(c);
    }

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
        backupCodes.map(c => bcrypt.hash(c, 10))
    );

    // Enable 2FA and save codes
    await prisma.user.update({
        where: { id: userId },
        data: {
            twoFactorEnabled: true,
            twoFactorBackupCodes: hashedBackupCodes
        }
    });

    return res.json({
      message: "2FA successfully enabled",
      backupCodes // Return plain codes for user to save
    });
  } catch (err) {
    console.error("💥 POST /api/2fa/verify-setup ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- Disable 2FA -------------------- */
// POST /api/2fa/disable - Disable 2FA (requires password)
router.post("/disable", async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required to disable 2FA" });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true } // Need password hash
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Disable 2FA
    await prisma.user.update({
        where: { id: userId },
        data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorBackupCodes: []
        }
    });

    return res.json({ message: "2FA disabled successfully" });
  } catch (err) {
    console.error("💥 POST /api/2fa/disable ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- Generate New Backup Codes -------------------- */
// POST /api/2fa/backup-codes - Generate new backup codes
router.post("/backup-codes", async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            password: true,
            twoFactorEnabled: true
        }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
        const c = Math.random().toString(36).substring(2, 10).toUpperCase();
        backupCodes.push(c);
    }

    // Hash backup codes
    const hashedBackupCodes = await Promise.all(
        backupCodes.map(c => bcrypt.hash(c, 10))
    );

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: hashedBackupCodes }
    });

    return res.json({
      message: "New backup codes generated",
      backupCodes
    });
  } catch (err) {
    console.error("💥 POST /api/2fa/backup-codes ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- Get 2FA Status -------------------- */
// GET /api/2fa/status - Check if 2FA is enabled
router.get("/status", async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Efficient select
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      enabled: user.twoFactorEnabled || false
    });
  } catch (err) {
    console.error("💥 GET /api/2fa/status ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
