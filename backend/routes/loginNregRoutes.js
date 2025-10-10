// backend/routes/loginNregRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Person = require("../person");
const Community = require("../models/Community");
const Member = require("../models/Member");
const authenticate = require("../middleware/authenticate");

require("dotenv").config();

const JWT_SECRET = process.env.MY_SECRET_KEY || process.env.JWT_SECRET || "devsecret";
if (!JWT_SECRET) {
  console.warn("[auth] JWT secret not set; using fallback devsecret");
}

/* ----------------------------- helpers ---------------------------------- */

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

/** Upsert a Member row (uses Member.person + Member.community) */
/** Upsert a membership in a schema-safe way (no strict errors).
 *  - Query only on canonical fields: person + community
 *  - On legacy unique index collision, upgrade the legacy row.
 */
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
    // 1) Normal path: upsert on canonical fields only (no unknown keys in filter)
    const m = await Member.findOneAndUpdate(
      { person: person._id, community: community._id },       // <— canonical only
      {
        $set: baseSet,
        // we still write legacy fields on first insert so a legacy unique index won't collide later
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
        strict: false,        // allow legacy fields in $setOnInsert
      }
    )
      .select("_id person personId community communityId fullName email avatar status role")
      .lean();

    // reflect on Person
    await Person.updateOne(
      { _id: person._id },
      { $addToSet: { communityIds: community._id } },
      { session }
    );

    return m;
  } catch (err) {
    // 2) If we collided with a legacy unique index (personId_1_communityId_1), upgrade that legacy row
    if (err?.code === 11000) {
      // find legacy doc *by legacy keys* (allow unknown query keys)
      const legacy = await Member.findOne(
        { personId: person._id, communityId: community._id }
      )
        .setOptions({ strictQuery: false, session })
        .lean();

      if (legacy?._id) {
        // upgrade the legacy doc to canonical fields
        await Member.updateOne(
          { _id: legacy._id },
          {
            $set: baseSet, // writes person + community + profile fields
          },
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
/**
 * GET /api/public/communities?q=&type=&paginated=&page=&limit=
 * Public, auth NOT required. Used by Registration dropdowns.
 * Returns minimal fields only.
 */
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
 * Body: { fullName, email, password, collegeId, religionId }
 * Creates user and **attaches** to EXISTING college + religion communities.
 * No community creation happens here.
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

    // Fetch target communities (must already exist, and not private)
    const [college, religion] = await Promise.all([
      Community.findOne({ _id: colId, type: "college", isPrivate: { $ne: true } }).select("_id name type key").lean(),
      Community.findOne({ _id: relId, type: "religion", isPrivate: { $ne: true } }).select("_id name type key").lean(),
    ]);
    if (!college) return res.status(400).json({ error: { collegeId: "College not found" } });
    if (!religion) return res.status(400).json({ error: { religionId: "Religion not found" } });

    let me;

    await session.withTransaction(async () => {
      // Unique email check inside txn
      const exists = await Person.findOne({ email: em }).session(session).lean();
      if (exists) {
        const err = new Error("User exists");
        err.code = "USER_EXISTS";
        throw err;
      }

      const hash = await bcrypt.hash(password, 10);

      // Create Person
      const created = await Person.create(
        [{ fullName: fn, email: em, password: hash, role: "user", communityIds: [] }],
        { session }
      );
      me = created[0];

      // Upsert memberships (college + religion)
      await Promise.all([
        upsertMembership({ session, person: me, community: college }),
        upsertMembership({ session, person: me, community: religion }),
      ]);
    });

    const token = signToken(me);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: { _id: me._id, fullName: me.fullName, email: me.email, role: me.role || "user" },
      communities: [
        { _id: college._id, name: college.name, type: college.type, key: college.key },
        { _id: religion._id, name: religion.name, type: religion.type, key: religion.key },
      ],
    });
  } catch (error) {
    if (error?.code === "USER_EXISTS") {
      return res.status(400).json({ error: { email: "An account with this email already exists" } });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ error: "Duplicate entry." });
    }
    console.error("POST /register error:", error);
    return res.status(400).json({ error: "Registration failed" });
  } finally {
    session.endSession();
  }
});

/* --------------------------------- LOGIN --------------------------------- */
/**
 * POST /login
 * Body: { email, password }
 * Returns: { message, token, user, communities }
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

    const token = signToken(user);

    let communities = [];
    if (Array.isArray(user.communityIds) && user.communityIds.length) {
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
        role: user.role || "user",
      },
      communities,
    });
  } catch (err) {
    console.error("POST /login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------------- PROFILE -------------------------------- */
/**
 * GET /profile
 * Requires: Authorization: Bearer <token>
 */
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
/**
 * GET /bootstrap
 * Requires: Authorization: Bearer <token>
 * Quick bootstrap after app loads, returns user + communities.
 */
router.get("/bootstrap", authenticate, async (req, res) => {
  try {
    const user = await Person.findById(req.user.id)
      .select("_id fullName email communityIds role")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const communities = await Community.find({ _id: { $in: user.communityIds || [] } })
      .select("_id name type key createdAt updatedAt")
      .lean();

    return res.status(200).json({ user, communities });
  } catch (err) {
    console.error("GET /bootstrap error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// backend/routes/loginNregRoutes.js (or a new file mounted at /api)
router.get("/api/my/communities", authenticate, async (req, res) => {
  const user = await Person.findById(req.user.id).select("communityIds").lean();
  const items = await Community.find({ _id: { $in: user?.communityIds || [] } })
    .select("_id name type key tags isPrivate createdAt")
    .lean();
  res.json(items);
});

module.exports = router;