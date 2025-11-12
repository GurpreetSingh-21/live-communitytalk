// backend/routes/loginNregRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto"); // We still need this

const Person = require("../person");
const Community = require("../models/Community");
const Member = require("../models/Member");
const authenticate = require("../middleware/authenticate");
const { sendVerificationEmail } = require("../services/emailService"); // Import our new service

require("dotenv").config();

const JWT_SECRET = process.env.MY_SECRET_KEY || process.env.JWT_SECRET || "devsecret";
if (!JWT_SECRET) {
  console.warn("[auth] JWT secret not set; using fallback devsecret");
}

/* ----------------------------- helpers ---------------------------------- */

// (Keep all your existing helper functions: normalizeEmail, validateRegisterByIds, signToken, upsertMembership)
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function validateRegisterByIds({ fullName, email, password, collegeId, religionId }) {
  const errors = {};
  const name = String(fullName || "").trim();
  const em = normalizeEmail(email);
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
    status: "active",
    role: "member",
  };

  try {
    const m = await Member.findOneAndUpdate(
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
    )
      .select("_id person personId community communityId fullName email avatar status role")
      .lean();

    await Person.updateOne(
      { _id: person._id },
      { $addToSet: { communityIds: community._id } },
      { session }
    );

    return m;
  } catch (err) {
    if (err?.code === 11000) {
      const legacy = await Member.findOne(
        { personId: person._id, communityId: community._id }
      )
        .setOptions({ strictQuery: false, session })
        .lean();

      if (legacy?._id) {
        await Member.updateOne(
          { _id: legacy._id },
          { $set: baseSet },
          { session, strict: false }
        );

        const upgraded = await Member.findById(legacy._id)
          .select("_id person personId community communityId fullName email avatar status role")
          .lean();

        await Person.updateOne(
          { _id: person._id },
          { $addToSet: { communityIds: community._id } },
          { session }
        );

        return upgraded;
      }
    }
    throw err;
  }
}

/* ------------------------------ PUBLIC CATALOG --------------------------- */
// (This route remains unchanged)
router.get("/api/public/communities", async (req, res) => {
  try {
    const { q = "", type, paginated = "true", page = 1, limit = 1000 } = req.query;

    const filter = { isPrivate: { $ne: true } };
    if (type) filter.type = type; // "college" | "religion" | "custom"

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { key: rx }, { slug: rx }, { description: rx }];
    }

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 2000);

    if (String(paginated) === "false") {
      const items = await Community.find(filter)
        .select("_id name type key tags")
        .sort({ name: 1 })
        .lean();
      return res.json({ items });
    }

    const [items, total] = await Promise.all([
      Community.find(filter)
        .select("_id name type key tags")
        .sort({ name: 1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      Community.countDocuments(filter),
    ]);

    return res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("GET /api/public/communities", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------- REGISTER ------------------------------- */
/**
 * POST /register
 * --- UPDATED: Does NOT log in. Sends verification 6-digit code. ---
 * --- FIX: Correctly handles resending code to unverified users. ---
 */
router.post("/register", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { fullName, email, password, collegeId, religionId } = req.body || {};
    const {
      ok,
      errors,
      fullName: fn,
      email: em,
      collegeId: colId,
      religionId: relId,
    } = validateRegisterByIds({ fullName, email, password, collegeId, religionId });

    if (!ok) return res.status(400).json({ error: errors });

    const [college, religion] = await Promise.all([
      Community.findOne({ _id: colId, type: "college", isPrivate: { $ne: true } }).select("_id name type key").lean(),
      Community.findOne({ _id: relId, type: "religion", isPrivate: { $ne: true } }).select("_id name type key").lean(),
    ]);
    if (!college) return res.status(400).json({ error: { collegeId: "College not found" } });
    if (!religion) return res.status(400).json({ error: { religionId: "Religion not found" } });

    let userForEmail;
    let verificationCode;
    let isResend = false;

    await session.withTransaction(async () => {
      const exists = await Person.findOne({ email: em }).session(session).select("+verificationCode");
      
      if (exists) {
        if (!exists.emailVerified) {
          // --- UNVERIFIED USER CASE ---
          exists.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          exists.verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour
          await exists.save();
          
          userForEmail = exists;
          verificationCode = exists.verificationCode;
          isResend = true;
        } else {
          // --- FULLY VERIFIED USER CASE ---
          const err = new Error("User exists");
          err.code = "USER_EXISTS";
          throw err; // This is a real error
        }
      } else {
        // --- NEW USER CASE ---
        const hash = await bcrypt.hash(password, 10);
        verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpires = new Date(Date.now() + 3600000);

        const created = await Person.create(
          [{ 
            fullName: fn, 
            email: em, 
            password: hash, 
            role: "user", 
            communityIds: [],
            verificationCode,
            verificationCodeExpires
          }],
          { session }
        );
        userForEmail = created[0];

        await Promise.all([
          upsertMembership({ session, person: userForEmail, community: college }),
          upsertMembership({ session, person: userForEmail, community: religion }),
        ]);
      }
    }); // Transaction ends here

    // --- Send Email (for BOTH new and unverified users) ---
    if (userForEmail && verificationCode) {
      await sendVerificationEmail(userForEmail.email, verificationCode);
    } else {
      // This shouldn't happen, but it's a good safeguard
      throw new Error("User or verification code was not set after transaction.");
    }
    
    // --- Return correct response ---
    if (isResend) {
      return res.status(200).json({ message: "Verification code resent. Please check your inbox." });
    } else {
      return res.status(201).json({
        message: "Registration successful. Please check your email for a 6-digit code.",
      });
    }

  } catch (error) {
    // (This catch block now handles real errors)
    if (error?.code === "USER_EXISTS") {
      return res.status(400).json({ error: { email: "An account with this email already exists" } });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ error: "Duplicate entry." });
    }
    console.error("POST /register error:", error);
    if (error.message === "Failed to send verification email.") {
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
    return res.status(400).json({ error: "Registration failed" });
  } finally {
    session.endSession();
  }
});

/* --------------------------------- LOGIN --------------------------------- */
/**
 * POST /login
 * --- UPDATED: Checks for emailVerified flag. ---
 */
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await Person.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

    // --- NEW: Verification Check ---
    if (!user.emailVerified) {
      return res.status(401).json({ 
        error: "Please verify your email to log in. Check your inbox for a 6-digit code.",
        code: "EMAIL_NOT_VERIFIED" 
      });
    }
    // --- END: Verification Check ---

    const token = signToken(user);
    
    let communities = [];
    if (Array.isArray(user.communityIds) && user.communityIds.length > 0) {
      communities = await Community.aggregate([
        { $match: { _id: { $in: user.communityIds } } },
        {
          $lookup: {
            from: "messages", 
            let: { communityId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$communityId", "$$communityId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "latestMessageDocs"
          }
        },
        {
          $project: {
            _id: 1, name: 1, type: 1, key: 1, createdAt: 1, updatedAt: 1,
            lastMessage: {
              $let: {
                vars: { firstMessage: { $arrayElemAt: ["$latestMessageDocs", 0] } },
                in: {
                  content: "$$firstMessage.content",
                  timestamp: "$$firstMessage.createdAt"
                }
              }
            }
          }
        }
      ]);
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role || "user",
      },
      communities,
    });
  } catch (err) {
    console.error("POST /login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------- NEW: VERIFY CODE -------------------------- */
/**
 * POST /api/verify-code
 * User submits the 6-digit code here.
 */
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    
    // We get the email from the request body
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !code) {
      return res.status(400).json({ error: "Email and code are required." });
    }

    // Find the user by email
    const user = await Person.findOne({ 
      email: normalizedEmail
      // Select the hidden fields needed for verification
    }).select("+verificationCode +verificationCodeExpires"); 

    if (!user) {
      // This is the error you saw in the screenshot
      return res.status(404).json({ error: "User not found." });
    }
    
    if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified." });
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: "Verification code has expired. Please register again to get a new one." });
    }

    // Verification successful!
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    
    return res.status(200).json({ message: "Email verified successfully. You can now log in." });

  } catch (err) {
    console.error("POST /api/verify-code error:", err);
    res.status(500).json({ error: "An error occurred during verification. Please try again later." });
  }
});/* -------------------------------- PROFILE -------------------------------- */
// (This route remains unchanged)
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select("_id fullName email communityIds role")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const communities = await Community.find({ _id: { $in: user.communityIds || [] } })
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

/* ------------------------------- BOOTSTRAP ------------------------------- */
// (This route remains unchanged and includes the lastMessage fix)
router.get("/bootstrap", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select("_id fullName email communityIds role")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const communityIds = Array.isArray(user.communityIds) ? user.communityIds : [];
    let communities = [];

    if (communityIds.length > 0) {
      communities = await Community.aggregate([
        { $match: { _id: { $in: communityIds } } },
        {
          $lookup: {
            from: "messages",
            let: { communityId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$communityId", "$$communityId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "latestMessageDocs"
          }
        },
        {
          $project: {
            _id: 1, name: 1, type: 1, key: 1, createdAt: 1, updatedAt: 1,
            lastMessage: {
              $let: {
                vars: { firstMessage: { $arrayElemAt: ["$latestMessageDocs", 0] } },
                in: {
                  content: "$$firstMessage.content",
                  timestamp: "$$firstMessage.createdAt"
                }
              }
            }
          }
        }
      ]);
    }

    return res.status(200).json({ user, communities });
  } catch (err) {
    console.error("GET /bootstrap error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// (This route remains unchanged)
router.get("/my/communities", authenticate, async (req, res) => {
  const user = await Person.findById(req.user.id).select("communityIds").lean();
  const items = await Community.find({ _id: { $in: user?.communityIds || [] } })
    .select("_id name type key tags isPrivate createdAt")
    .lean();
  res.json(items);
});

module.exports = router;