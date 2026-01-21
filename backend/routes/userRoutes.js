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

    // 5. CACHE INVALIDATION: Clear bootstrap and profile cache so next fetch gets fresh avatar
    if (req.redisClient) {
      const bootstrapKey = `bootstrap:${userId}`;
      const profileKey = `user:profile:${userId}`;
      try {
        await req.redisClient.del(bootstrapKey);
        await req.redisClient.del(profileKey);
        console.log(`🧹 [Cache] Invalidated ${bootstrapKey} & ${profileKey}`);
      } catch (err) {
        console.warn("Failed to invalidate cache:", err);
      }
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

    // 🚀 Try Redis cache first
    const cacheKey = `user:profile:${id}`;
    if (req.redisClient) {
      const cached = await req.redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ [Cache HIT] User profile ${id}`);
        return res.json(JSON.parse(cached));
      }
    }

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

    const responseUser = {
      _id: user.id,
      ...user
    };

    // 💾 Cache for 30 minutes (aggressive)
    if (req.redisClient) {
      await req.redisClient.setex(cacheKey, 1800, JSON.stringify(responseUser));
      console.log(`💾 [Cache MISS] Cached user profile ${id}`);
    }

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

    // Invalidate cached public key so other users don't encrypt with stale keys for up to 1 hour
    // (stale encryption = guaranteed decrypt failures)
    if (req.redisClient) {
      try {
        const cacheKey = `user:publicKey:${userId}`;
        await req.redisClient.del(cacheKey);
      } catch (e) {
        // non-fatal
      }
    }

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

    // 🚀 Try Redis cache first
    const cacheKey = `user:publicKey:${id}`;
    if (req.redisClient) {
      const cached = await req.redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ [Cache HIT] PublicKey ${id}`);
        return res.json(JSON.parse(cached));
      }
    }

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

    const response = { publicKey: user.publicKey };

    // 💾 Cache for 1 hour (public keys rarely change)
    if (req.redisClient) {
      await req.redisClient.setex(cacheKey, 3600, JSON.stringify(response));
      console.log(`💾 [Cache MISS] Cached publicKey ${id}`);
    }
    return res.json(response);
  } catch (err) {
    console.error("[User Routes] GET publicKey error:", err);
    return res.status(500).json({ error: "Failed to fetch public key" });
  }
});

// ───────────────────────── E2EE Bundle (Signed + One-Time Prekeys) ─────────────────────────
/**
 * PUT /api/user/e2ee/bundle
 * Save prekey bundle: signedPrekey (currently just a prekey) and one-time prekeys.
 * NOTE: We don't verify signatures yet; signedPrekeySig is optional and reserved for future use.
 */
router.put("/e2ee/bundle", async (req, res) => {
  try {
    const userId = req.user.id;
    const { signedPrekey, signedPrekeySig = null, oneTimePrekeys = [] } = req.body || {};

    if (!signedPrekey || !Array.isArray(oneTimePrekeys)) {
      return res.status(400).json({ error: "signedPrekey and oneTimePrekeys[] are required" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        e2eeSignedPrekey: signedPrekey,
        e2eeSignedPrekeySig: signedPrekeySig,
        e2eeOneTimePrekeys: oneTimePrekeys,
        e2eeBundleVersion: { increment: 1 },
        e2eeBundleUpdatedAt: new Date()
      }
    });

    // Invalidate cached public key as bundle implies new key material usage
    if (req.redisClient) {
      try { await req.redisClient.del(`user:publicKey:${userId}`); } catch {}
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[User Routes] PUT e2ee/bundle error:", err);
    return res.status(500).json({ error: "Failed to save bundle" });
  }
});

/**
 * GET /api/user/:id/e2ee/bundle
 * Fetch a user's bundle; consumes one one-time-prekey (first) if available.
 */
router.get("/:id/e2ee/bundle", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        publicKey: true,
        e2eeSignedPrekey: true,
        e2eeSignedPrekeySig: true,
        e2eeOneTimePrekeys: true,
        e2eeBundleVersion: true
      }
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    // Bundle requires publicKey + signedPrekey (signature is optional, we removed it)
    if (!user.publicKey || !user.e2eeSignedPrekey) {
      return res.status(404).json({ error: "No bundle available" });
    }

    const prekeys = Array.isArray(user.e2eeOneTimePrekeys) ? [...user.e2eeOneTimePrekeys] : [];
    const oneTimePrekey = prekeys.shift() || null; // consume first

    // Save back the truncated list (do not block response on errors)
    prisma.user.update({
      where: { id },
      data: { e2eeOneTimePrekeys: prekeys }
    }).catch(() => {});

    return res.json({
      publicKey: user.publicKey,
      signedPrekey: user.e2eeSignedPrekey,
      signedPrekeySig: user.e2eeSignedPrekeySig,
      oneTimePrekey,
      bundleVersion: user.e2eeBundleVersion || 1
    });
  } catch (err) {
    console.error("[User Routes] GET e2ee/bundle error:", err);
    return res.status(500).json({ error: "Failed to fetch bundle" });
  }
});

// ───────────────────────── E2EE Identity Backup Endpoints ─────────────────────────
/**
 * PUT /api/user/e2ee/backup
 * Store/update the user's encrypted E2EE identity backup blob.
 * The blob MUST already be encrypted on the client; server treats it as opaque.
 */
router.put("/e2ee/backup", async (req, res) => {
  try {
    const userId = req.user.id;
    const { backup } = req.body;

    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: "backup (object) is required" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { e2eeBackup: backup }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[User Routes] PUT e2ee/backup error:", err);
    return res.status(500).json({ error: "Failed to save backup" });
  }
});

/**
 * GET /api/user/e2ee/backup
 * Fetch the caller's encrypted E2EE identity backup blob.
 */
router.get("/e2ee/backup", async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { e2eeBackup: true }
    });

    if (!user || !user.e2eeBackup) {
      return res.status(404).json({ error: "No backup found" });
    }

    return res.json({ backup: user.e2eeBackup });
  } catch (err) {
    console.error("[User Routes] GET e2ee/backup error:", err);
    return res.status(500).json({ error: "Failed to fetch backup" });
  }
});

module.exports = router;