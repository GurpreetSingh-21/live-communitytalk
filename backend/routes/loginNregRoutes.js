// backend/routes/loginNregRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const speakeasy = require("speakeasy");

const Person = require("../person");
const Community = require("../models/Community");
const College = require("../models/College"); // ✅ Import College model
const Member = require("../models/Member");
const authenticate = require("../middleware/authenticate");
const { sendVerificationEmail } = require("../services/emailService");

require("dotenv").config();

const JWT_SECRET = process.env.MY_SECRET_KEY || process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("⚠️ [auth] JWT secret not set. Server startup should have failed.");
}

/* ----------------------------- helpers ---------------------------------- */

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const signToken = (user) =>
  jwt.sign(
    { id: String(user._id), email: user.email, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: "14d" }
  );

async function upsertMembership({ session, person, community }) {
  const baseSet = {
    person: person._id,
    community: community._id,
    name: person.fullName || person.email,
    fullName: person.fullName || person.email,
    email: person.email,
    avatar: person.avatar || "/default-avatar.png",
    memberStatus: "active",
    role: "member",
  };

  await Member.findOneAndUpdate(
    { person: person._id, community: community._id },
    {
      $set: baseSet,
      $setOnInsert: {
        personId: person._id,
        communityId: community._id,
      },
    },
    {
      new: true,
      upsert: true,
      session,
      setDefaultsOnInsert: true,
      strict: false,
    }
  );

  await Person.updateOne(
    { _id: person._id },
    { $addToSet: { communityIds: community._id } },
    { session }
  );
}

function validateRegisterByIds({
  fullName,
  email,
  password,
  collegeId,
  religionId,
}) {
  const errors = {};
  const name = String(fullName || "").trim();
  const em = normalizeEmail(email);
  // collegeId is now an ID from the College collection
  const colId = String(collegeId || "").trim();
  const relId = String(religionId || "").trim();

  if (!name) errors.fullName = "Full name is required";
  if (!em) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(em)) errors.email = "Email is invalid";

  if (!password || typeof password !== "string") {
    errors.password = "Password is required";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!mongoose.isValidObjectId(colId)) errors.collegeId = "College is required";
  if (!mongoose.isValidObjectId(relId)) errors.religionId = "Religion is required";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    fullName: name,
    email: em,
    collegeId: colId,
    religionId: relId,
  };
}

/* -------------------------------- REGISTER ------------------------------- */
router.post("/register", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { fullName, email, password, collegeId, religionId } = req.body || {};
    
    // Basic validation
    const { ok, errors } = validateRegisterByIds({
      fullName,
      email,
      password,
      collegeId,
      religionId,
    });

    if (!ok) return res.status(400).json({ error: errors });

    // 1. Resolve College ID -> Community ID
    // The frontend sends a `collegeId` which is an _id from the College collection.
    // We need to find the College doc to get the linked `communityId`.
    const collegeDoc = await College.findById(collegeId).lean();
    
    if (!collegeDoc) {
       return res.status(400).json({ error: { collegeId: "College not found" } });
    }
    
    if (!collegeDoc.communityId) {
      return res.status(400).json({ error: { collegeId: "Invalid college data: no linked community" } });
    }

    // 2. Find the actual Community documents
    // collegeCommunity is the chat group for the college
    // religionCommunity is the chat group for the religion
    const [collegeCommunity, religionCommunity] = await Promise.all([
      Community.findById(collegeDoc.communityId).select("_id name type key").lean(),
      Community.findOne({ _id: religionId, type: "religion" }).select("_id name type key").lean(),
    ]);

    if (!collegeCommunity) {
        return res.status(400).json({ error: { collegeId: "College community chat not found" } });
    }
    if (!religionCommunity) {
        return res.status(400).json({ error: { religionId: "Religion not found" } });
    }

    let userForEmail;
    let verificationCode;
    let isResend = false;

    await session.withTransaction(async () => {
      const exists = await Person.findOne({ email: normalizeEmail(email) }).session(session);

      if (exists) {
        if (!exists.emailVerified) {
          // Unverified user → regenerate code
          exists.verificationCode = Math.floor(
            100000 + Math.random() * 900000
          ).toString();
          exists.verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour
          await exists.save({ session });

          userForEmail = exists;
          verificationCode = exists.verificationCode;
          isResend = true;
        } else {
          // Verified user already exists
          const err = new Error("User exists");
          err.code = "USER_EXISTS";
          throw err;
        }
      } else {
        // New user
        const hash = await bcrypt.hash(password, 10);
        verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpires = new Date(Date.now() + 3600000);

        const [created] = await Person.create(
          [
            {
              fullName,
              email: normalizeEmail(email),
              password: hash,
              role: "user",
              communityIds: [],
              verificationCode,
              verificationCodeExpires,
              emailVerified: false,
              // Store College Name/Slug from the College metadata doc
              collegeName: collegeDoc.name,
              collegeSlug: collegeDoc.key,
              religionKey: religionCommunity.key,
              // dating flags default from schema
            },
          ],
          { session }
        );
        userForEmail = created;

        // Join both communities
        await Promise.all([
          upsertMembership({ session, person: userForEmail, community: collegeCommunity }),
          upsertMembership({ session, person: userForEmail, community: religionCommunity }),
        ]);
      }
    });

    // Send email
    if (userForEmail && verificationCode) {
      await sendVerificationEmail(userForEmail.email, verificationCode);
    }

    if (isResend) {
      return res
        .status(200)
        .json({ message: "Verification code resent. Please check your inbox." });
    } else {
      return res.status(201).json({
        message:
          "Registration successful. Please check your email for a 6-digit code.",
      });
    }
  } catch (error) {
    if (error?.code === "USER_EXISTS") {
      return res
        .status(400)
        .json({ error: { email: "An account with this email already exists" } });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ error: "Duplicate entry." });
    }
    console.error("POST /register error:", error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    session.endSession();
  }
});

/* --------------------------------- LOGIN --------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await Person.findOne({ email }).select("+password");
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.emailVerified) {
      return res.status(401).json({
        error:
          "Please verify your email to log in. Check your inbox for a 6-digit code.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // ✅ Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempToken = jwt.sign(
        { id: user._id, temp2FA: true },
        JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.status(200).json({
        requires2FA: true,
        tempToken,
        message: "Please enter your 2FA code"
      });
    }

    // Regular login (no 2FA)
    const token = signToken(user);

    let communities = [];
    if (Array.isArray(user.communityIds) && user.communityIds.length > 0) {
      communities = await Community.find({ _id: { $in: user.communityIds } })
        .select("_id name type key createdAt updatedAt")
        .lean();
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role || "user",
        hasDatingProfile: user.hasDatingProfile || false,
        datingProfileId: user.datingProfileId || null,
        collegeSlug: user.collegeSlug || null,
        religionKey: user.religionKey || null,
      },
      communities,
    });
  } catch (err) {
    console.error("POST /login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------- 2FA VERIFY LOGIN -------------------------- */
router.post("/verify-2fa-login", async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ error: "Temp token and 2FA code are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired temp token" });
    }

    if (!decoded.temp2FA) {
      return res.status(401).json({ error: "Invalid temp token" });
    }

    const user = await Person.findById(decoded.id).select("+twoFactorSecret +twoFactorBackupCodes");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA is not enabled for this account" });
    }

    // Try TOTP code first
    const totpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2
    });

    let isValid = totpValid;

    // If TOTP fails, try backup codes
    if (!totpValid && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        const isMatch = await bcrypt.compare(code, user.twoFactorBackupCodes[i]);
        if (isMatch) {
          isValid = true;
          // Remove used backup code
          user.twoFactorBackupCodes.splice(i, 1);
          await user.save();
          break;
        }
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid 2FA code" });
    }

    // Issue final auth token
    const token = signToken(user);

    let communities = [];
    if (Array.isArray(user.communityIds) && user.communityIds.length > 0) {
      communities = await Community.find({ _id: { $in: user.communityIds } })
        .select("_id name type key createdAt updatedAt")
        .lean();
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role || "user",
        hasDatingProfile: user.hasDatingProfile || false,
        datingProfileId: user.datingProfileId || null,
        collegeSlug: user.collegeSlug || null,
        religionKey: user.religionKey || null,
      },
      communities,
    });
  } catch (err) {
    console.error("POST /verify-2fa-login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------- VERIFY CODE -------------------------- */
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !code) {
      return res.status(400).json({ error: "Email and code are required." });
    }

    const user = await Person.findOne({
      email: normalizedEmail,
    }).select("+verificationCode +verificationCodeExpires");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified." });
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({
        error:
          "Verification code has expired. Please register again to get a new one.",
      });
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role || "user",
        hasDatingProfile: user.hasDatingProfile || false,
        datingProfileId: user.datingProfileId || null,
        collegeSlug: user.collegeSlug || null,
        religionKey: user.religionKey || null,
      },
      communities: [],
    });
  } catch (err) {
    console.error("POST /verify-code error:", err);
    res.status(500).json({
      error:
        "An error occurred during verification. Please try again later.",
    });
  }
});

/* --------------------------- PROFILE (GET) --------------------------- */
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select(
        "_id fullName email avatar bio communityIds role notificationPrefs privacyPrefs hasDatingProfile datingProfileId collegeSlug religionKey"
      )
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const communities = await Community.find({
      _id: { $in: user.communityIds || [] },
    })
      .select("_id name type key createdAt updatedAt")
      .lean();

    return res.status(200).json({
      message: "Welcome to your profile!",
      user,
      communities,
      iat: req.user.iat,
      exp: req.user.exp,
    });
  } catch (err) {
    console.error("GET /profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------ PATCH /profile (update name) ------------------- */
router.patch("/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = {};
    const errors = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "fullName")) {
      const raw = String(req.body.fullName || "").trim();
      if (!raw) {
        errors.fullName = "Full name is required";
      } else if (raw.length < 2) {
        errors.fullName = "Full name must be at least 2 characters";
      } else if (raw.length > 80) {
        errors.fullName = "Full name must be at most 80 characters";
      } else {
        updates.fullName = raw;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "bio")) {
      const raw = String(req.body.bio || "").trim();
      if (raw.length > 500) {
        errors.bio = "Bio must be at most 500 characters";
      } else {
        updates.bio = raw;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: errors });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await Person.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    )
      .select("_id fullName email avatar bio communityIds role")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (updates.fullName) {
      await Member.updateMany(
        { person: userId },
        { $set: { fullName: updates.fullName, name: updates.fullName } }
      );
    }

    const communities = await Community.find({
      _id: { $in: user.communityIds || [] },
    })
      .select("_id name type key createdAt updatedAt")
      .lean();

    return res.status(200).json({
      message: "Profile updated",
      user,
      communities,
    });
  } catch (err) {
    console.error("PATCH /profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------ NOTIFICATION / PRIVACY PREFS (GET/PUT) ------------------ */
router.get("/notification-prefs", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select("notificationPrefs privacyPrefs")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const notifDefaults = {
      pushEnabled: true,
      dms: true,
      communities: true,
      mentions: true,
    };

    const privacyDefaults = {
      showOnlineStatus: true,
      allowDMsFromSameCollege: true,
      allowDMsFromOthers: false,
    };

    const notificationPrefs = user.notificationPrefs || notifDefaults;
    const privacyPrefs = user.privacyPrefs || privacyDefaults;

    const merged = {
      ...notifDefaults,
      ...notificationPrefs,
      ...privacyDefaults,
      ...privacyPrefs,
    };

    return res.status(200).json({ notificationPrefs: merged });
  } catch (err) {
    console.error("GET /notification-prefs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/notification-prefs", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      pushEnabled,
      dms,
      communities,
      mentions,
      showOnlineStatus,
      allowDMsFromSameCollege,
      allowDMsFromOthers,
    } = req.body || {};

    const notifUpdates = {};
    const privacyUpdates = {};
    const errors = {};

    const assignNotif = (key, value) => {
      if (value === undefined) return;
      if (typeof value !== "boolean") {
        errors[key] = "Must be a boolean";
      } else {
        notifUpdates[key] = value;
      }
    };

    const assignPrivacy = (key, value) => {
      if (value === undefined) return;
      if (typeof value !== "boolean") {
        errors[key] = "Must be a boolean";
      } else {
        privacyUpdates[key] = value;
      }
    };

    assignNotif("pushEnabled", pushEnabled);
    assignNotif("dms", dms);
    assignNotif("communities", communities);
    assignNotif("mentions", mentions);

    assignPrivacy("showOnlineStatus", showOnlineStatus);
    assignPrivacy("allowDMsFromSameCollege", allowDMsFromSameCollege);
    assignPrivacy("allowDMsFromOthers", allowDMsFromOthers);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: errors });
    }

    if (
      Object.keys(notifUpdates).length === 0 &&
      Object.keys(privacyUpdates).length === 0
    ) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const existing = await Person.findById(userId)
      .select("notificationPrefs privacyPrefs")
      .lean();

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const notifDefaults = {
      pushEnabled: true,
      dms: true,
      communities: true,
      mentions: true,
    };

    const privacyDefaults = {
      showOnlineStatus: true,
      allowDMsFromSameCollege: true,
      allowDMsFromOthers: false,
    };

    const currentNotif = existing.notificationPrefs || notifDefaults;
    const currentPrivacy = existing.privacyPrefs || privacyDefaults;

    const nextNotifPrefs = {
      ...notifDefaults,
      ...currentNotif,
      ...notifUpdates,
    };

    const nextPrivacyPrefs = {
      ...privacyDefaults,
      ...currentPrivacy,
      ...privacyUpdates,
    };

    const user = await Person.findByIdAndUpdate(
      userId,
      {
        $set: {
          notificationPrefs: nextNotifPrefs,
          privacyPrefs: nextPrivacyPrefs,
        },
      },
      { new: true }
    )
      .select("_id email notificationPrefs privacyPrefs")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const merged = {
      ...notifDefaults,
      ...(user.notificationPrefs || {}),
      ...privacyDefaults,
      ...(user.privacyPrefs || {}),
    };

    return res.status(200).json({
      message: "Notification preferences updated",
      notificationPrefs: merged,
    });
  } catch (err) {
    console.error("PUT /notification-prefs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------- BOOTSTRAP ------------------------------- */
router.get("/bootstrap", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select(
        "_id fullName email avatar bio communityIds role notificationPrefs privacyPrefs hasDatingProfile datingProfileId collegeSlug religionKey"
      )
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const communityIds = Array.isArray(user.communityIds) ? user.communityIds : [];
    let communities = [];

    if (communityIds.length > 0) {
      communities = await Community.find({ _id: { $in: communityIds } })
        .select("_id name type key createdAt updatedAt")
        .lean();
    }

    return res.status(200).json({ user, communities });
  } catch (err) {
    console.error("GET /bootstrap error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------- MY COMMUNITIES -------------------------- */
router.get("/my/communities", authenticate, async (req, res) => {
  const user = await Person.findById(req.user.id).select("communityIds").lean();
  const items = await Community.find({ _id: { $in: user?.communityIds || [] } })
    .select("_id name type key tags isPrivate createdAt")
    .lean();
  res.json(items);
});

module.exports = router;