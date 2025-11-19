const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/requireAdmin");
const Person = require("../person");
const Community = require("../models/Community");
const Member = require("../models/Member");
const DatingProfile = require("../models/DatingProfile"); // ⬅️ NEW: for dating admin


const ROOM = (id) => `community:${id}`;
const slugify = (s = "") =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");

const JWT_SECRET =
  process.env.MY_SECRET_KEY || process.env.JWT_SECRET || "devsecret";

console.log("[adminRoutes] Loaded. JWT_SECRET present:", !!JWT_SECRET);

/* ------------------------------------------------------------------ *
 * PUBLIC: Admin Login
 * ------------------------------------------------------------------ */

// POST /api/admin/login
router.post("/login", async (req, res) => {
  console.log("========================================");
  console.log("🔥 [/api/admin/login] HIT");
  console.log("Headers.authorization:", req.headers?.authorization || null);
  console.log("Body (raw):", req.body);

  try {
    const { email, password } = req.body || {};

    console.log("[/api/admin/login] Parsed email:", email);
    console.log(
      "[/api/admin/login] Password length:",
      password ? String(password).length : 0
    );

    if (!email || !password) {
      console.log("[/api/admin/login] Missing email or password");
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const em = String(email).trim().toLowerCase();
    console.log("[/api/admin/login] Normalized email:", em);

    const user = await Person.findOne({ email: em }).select("+password").lean();

    if (!user) {
      console.log("[/api/admin/login] No user found for email:", em);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("[/api/admin/login] Found user:", {
      id: user._id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
    });

    if (user.role !== "admin") {
      console.log(
        "[/api/admin/login] User is not admin. role =",
        user.role
      );
      return res.status(403).json({ error: "Not an admin account" });
    }

    const pwHashPreview = (user.password || "").slice(0, 10) + "...";
    console.log(
      "[/api/admin/login] Stored hash preview:",
      user.password ? pwHashPreview : "NO PASSWORD FIELD"
    );
    console.log("[/api/admin/login] Full stored hash:", user.password);
    console.log("[/api/admin/login] Incoming password:", password);

    const ok = await bcrypt.compare(password, user.password || "");
    console.log("[/api/admin/login] bcrypt.compare result:", ok);

    if (!ok) {
      console.log(
        "[/api/admin/login] Password mismatch for email:",
        em
      );
      console.log("[/api/admin/login] Expected hash:", user.password);
      console.log("[/api/admin/login] Provided password:", password);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const tokenPayload = { id: user._id, role: user.role };
    console.log("[/api/admin/login] Signing JWT with payload:", tokenPayload);

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("[/api/admin/login] SUCCESS. Returning token.");
    console.log("========================================");

    return res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("💥 POST /api/admin/login ERROR:", e);
    console.log("========================================");
    res.status(500).json({ error: "Server error" });
  }
});

// 🔐 Everything below this line requires a valid admin JWT
// Admin-only
router.use((req, _res, next) => {
  console.log("🔐 [adminRoutes] Entering admin-only middleware");
  next();
});
router.use(authenticate, requireAdmin);

/* ------------------------------------------------------------------ *
 * Communities: list / create / update / delete
 * ------------------------------------------------------------------ */

// GET /api/admin/communities?q=&type=&page=&limit=&includePrivate=true|false
router.get("/communities", async (req, res) => {
  console.log("📡 [GET /api/admin/communities] Query:", req.query);
  console.log("👤 Admin user:", req.user && { id: req.user.id, role: req.user.role });

  try {
    const {
      q = "",
      type,
      page = 1,
      limit = 50,
      includePrivate = "true",
    } = req.query;

    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: rx },
        { key: rx },
        { slug: rx },
        { description: rx },
        { tags: rx },
      ];
    }
    if (type) filter.type = type;
    if (includePrivate !== "true") filter.isPrivate = { $ne: true };

    console.log("[GET /api/admin/communities] Mongo filter:", filter);

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const [items, total] = await Promise.all([
      Community.find(filter)
        .select("_id name type key slug isPrivate tags createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      Community.countDocuments(filter),
    ]);

    console.log(
      "[GET /api/admin/communities] Returning",
      items.length,
      "items of total",
      total
    );

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("💥 GET /api/admin/communities ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/communities
router.post("/communities", async (req, res) => {
  console.log("📡 [POST /api/admin/communities] Body:", req.body);
  console.log("👤 Admin user:", req.user && { id: req.user.id, role: req.user.role });

  try {
    let {
      name,
      type = "custom",
      key,
      isPrivate = false,
      tags = [],
      collegeId,
      collegeKey,
    } = req.body || {};

    if (!name?.trim())
      return res.status(400).json({ error: "Name is required" });
    if (!["college", "religion", "custom"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const baseTags = Array.isArray(tags) ? tags.slice(0, 20) : [];

    if (type === "college") {
      const k = key?.trim() || slugify(name);
      console.log("[POST /communities] Creating college community with key:", k);

      const created = await Community.create({
        name: name.trim(),
        type,
        key: k,
        isPrivate: !!isPrivate,
        tags: baseTags,
        createdBy: req.user.id,
      });

      console.log("[POST /communities] Created college community:", created._id);

      req.io?.emit("admin:communityChanged", {
        action: "create",
        community: {
          _id: created._id,
          name: created.name,
          type: created.type,
          key: created.key,
          isPrivate: created.isPrivate,
          slug: created.slug,
          tags: created.tags,
        },
      });
      return res.status(201).json(created);
    }

    if (type === "religion") {
      const religionName = name.trim();
      const religionKey = slugify(key?.trim() || religionName);

      let finalName = religionName;
      let finalKey = religionKey;
      const tagset = new Set(baseTags);

      console.log("[POST /communities] Creating religion community:", {
        religionName,
        religionKey,
        collegeId,
        collegeKey,
      });

      if (collegeId || collegeKey) {
        const colFilter = collegeId
          ? { _id: collegeId }
          : { key: slugify(collegeKey) };
        console.log("[POST /communities] Looking up college with:", colFilter);

        const college = await Community.findOne({
          ...colFilter,
          type: "college",
        }).lean();
        if (!college)
          return res.status(400).json({ error: "College not found" });

        finalName = `${religionName} @ ${college.name}`;
        finalKey = `${college.key}__${religionKey}`;
        tagset.add(`college:${college.key}`);
      }

      const created = await Community.create({
        name: finalName,
        type,
        key: finalKey,
        isPrivate: !!isPrivate,
        tags: Array.from(tagset).slice(0, 20),
        createdBy: req.user.id,
      });

      console.log("[POST /communities] Created religion community:", created._id);

      req.io?.emit("admin:communityChanged", {
        action: "create",
        community: {
          _id: created._id,
          name: created.name,
          type: created.type,
          key: created.key,
          isPrivate: created.isPrivate,
          slug: created.slug,
          tags: created.tags,
        },
      });
      return res.status(201).json(created);
    }

    if (type === "custom") {
      const k = key?.trim() || slugify(name);
      console.log("[POST /communities] Creating custom community with key:", k);

      const created = await Community.create({
        name: name.trim(),
        type,
        key: k,
        isPrivate: !!isPrivate,
        tags: baseTags,
        createdBy: req.user.id,
      });

      console.log("[POST /communities] Created custom community:", created._id);

      req.io?.emit("admin:communityChanged", {
        action: "create",
        community: {
          _id: created._id,
          name: created.name,
          type: created.type,
          key: created.key,
          isPrivate: created.isPrivate,
          slug: created.slug,
          tags: created.tags,
        },
      });
      return res.status(201).json(created);
    }
  } catch (e) {
    console.error("💥 POST /api/admin/communities ERROR", e);
    if (e?.code === 11000) {
      return res.status(400).json({ error: "Duplicate (type,key) or slug" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/communities/:id
router.patch("/communities/:id", async (req, res) => {
  console.log("📡 [PATCH /api/admin/communities/:id] Params:", req.params);
  console.log("Body:", req.body);

  try {
    const { id } = req.params;
    const update = {};

    if (typeof req.body.name === "string" && req.body.name.trim()) {
      update.name = req.body.name.trim();
    }
    if (typeof req.body.key === "string") {
      update.key = req.body.key.trim();
    }
    if (typeof req.body.isPrivate === "boolean") {
      update.isPrivate = req.body.isPrivate;
    }
    if (Array.isArray(req.body.tags)) {
      update.tags = req.body.tags.slice(0, 20);
    }

    console.log("[PATCH /communities/:id] Update payload:", update);

    const saved = await Community.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .select("_id name type key slug isPrivate tags")
      .lean();

    if (!saved) {
      console.log("[PATCH /communities/:id] Not found:", id);
      return res.status(404).json({ error: "Not found" });
    }

    req.io?.emit("admin:communityChanged", {
      action: "update",
      community: {
        _id: saved._id,
        name: saved.name,
        type: saved.type,
        key: saved.key,
        isPrivate: saved.isPrivate,
        slug: saved.slug,
        tags: saved.tags,
      },
    });

    res.json(saved);
  } catch (e) {
    console.error("💥 PATCH /api/admin/communities/:id ERROR", e);
    if (e?.code === 11000) {
      return res.status(400).json({ error: "Duplicate (type,key) or slug" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/communities/:id
router.delete("/communities/:id", async (req, res) => {
  console.log("📡 [DELETE /api/admin/communities/:id] Params:", req.params);

  try {
    const { id } = req.params;
    const cc = await Community.findByIdAndDelete(id).lean();
    if (!cc) {
      console.log("[DELETE /communities/:id] Not found:", id);
      return res.status(404).json({ error: "Not found" });
    }

    console.log("[DELETE /communities/:id] Deleted community:", id);
    await Member.deleteMany({ community: id });

    req.io?.emit("admin:communityChanged", {
      action: "delete",
      communityId: String(id),
    });
    req.io?.to(ROOM(id)).emit("community:deleted", { communityId: String(id) });

    res.json({ message: "Deleted" });
  } catch (e) {
    console.error("💥 DELETE /api/admin/communities/:id ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------------------------ *
 * People: list / update
 * ------------------------------------------------------------------ */

// ✅ NEW: Users list for /admin/users panel
router.get("/users", async (req, res) => {
  console.log("📡 [GET /api/admin/users] Query:", req.query);

  try {
    const { q = "", role, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: rx }, { email: rx }];
    }
    if (role && ["user", "mod", "admin"].includes(String(role))) {
      filter.role = String(role);
    }

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const [people, total] = await Promise.all([
      Person.find(filter)
        .select(
          "_id fullName email role isActive collegeSlug religionKey hasDatingProfile datingProfileId communityIds createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      Person.countDocuments(filter),
    ]);

    const items = people.map((p) => ({
      _id: String(p._id),
      fullName: p.fullName,
      email: p.email,
      role: p.role || "user",
      isActive: p.isActive !== false,
      collegeSlug: p.collegeSlug || null,
      religionKey: p.religionKey || null,
      hasDatingProfile: !!p.hasDatingProfile,
      datingProfileId: p.datingProfileId || null,
      createdAt: p.createdAt,
      communitiesCount: Array.isArray(p.communityIds)
        ? p.communityIds.length
        : 0,
    }));

    return res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("💥 GET /api/admin/users ERROR", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/people
router.get("/people", async (req, res) => {
  console.log("📡 [GET /api/admin/people] Query:", req.query);

  try {
    const { q = "", page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: rx }, { email: rx }];
    }

    console.log("[GET /people] Filter:", filter);

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const [items, total] = await Promise.all([
      Person.find(filter)
        .select("_id fullName email role communityIds createdAt")
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      Person.countDocuments(filter),
    ]);

    console.log(
      "[GET /people] Returning",
      items.length,
      "items of total",
      total
    );

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("💥 GET /api/admin/people ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/people/:id
router.patch("/people/:id", async (req, res) => {
  console.log("📡 [PATCH /api/admin/people/:id] Params:", req.params);
  console.log("Body:", req.body);

  try {
    const { id } = req.params;
    const update = {};

    if (typeof req.body.fullName === "string") {
      update.fullName = req.body.fullName.trim();
    }
    if (typeof req.body.email === "string") {
      update.email = req.body.email.trim().toLowerCase();
    }
    if (typeof req.body.role === "string") {
      if (!["user", "mod", "admin"].includes(req.body.role)) {
        console.log("[PATCH /people/:id] Invalid role:", req.body.role);
        return res.status(400).json({ error: "Invalid role" });
      }
      update.role = req.body.role;
    }

    console.log("[PATCH /people/:id] Update payload:", update);

    const saved = await Person.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .select("_id fullName email role communityIds")
      .lean();

    if (!saved) {
      console.log("[PATCH /people/:id] Not found:", id);
      return res.status(404).json({ error: "Not found" });
    }

    req.io?.emit("admin:userChanged", { action: "update", user: saved });
    res.json(saved);
  } catch (e) {
    console.error("💥 PATCH /api/admin/people/:id ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------------------------ *
 * Membership ops: add / remove
 * ------------------------------------------------------------------ */

router.post("/memberships", async (req, res) => {
  console.log("📡 [POST /api/admin/memberships] Body:", req.body);

  try {
    const { personId, communityId } = req.body || {};
    if (
      !mongoose.isValidObjectId(personId) ||
      !mongoose.isValidObjectId(communityId)
    ) {
      console.log(
        "[POST /memberships] Invalid ids:",
        "personId=",
        personId,
        "communityId=",
        communityId
      );
      return res.status(400).json({ error: "Invalid ids" });
    }

    const [person, community] = await Promise.all([
      Person.findById(personId).select("_id fullName email avatar").lean(),
      Community.findById(communityId).select("_id name").lean(),
    ]);
    if (!person || !community) {
      console.log("[POST /memberships] User or community not found");
      return res.status(404).json({ error: "User or community not found" });
    }

    const member = await Member.findOneAndUpdate(
      { person: person._id, community: community._id },
      {
        $setOnInsert: {
          person: person._id,
          community: community._id,
          memberStatus: "active",
          role: "member",
        },
        $set: {
          name: person.fullName || person.email,
          email: person.email,
          avatar: person.avatar || "/default-avatar.png",
        },
      },
      { new: true, upsert: true }
    ).lean();

    console.log("[POST /memberships] Upserted member:", member?._id);

    await Person.updateOne(
      { _id: person._id },
      { $addToSet: { communityIds: community._id } }
    );

    req.io?.to(ROOM(communityId)).emit("members:changed", {
      communityId: String(communityId),
      action: "upsert",
      member,
    });
    req.io?.emit("admin:membershipChanged", { action: "upsert", member });

    res.status(201).json(member);
  } catch (e) {
    console.error("💥 POST /api/admin/memberships ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/memberships/:memberId", async (req, res) => {
  console.log("📡 [DELETE /api/admin/memberships/:memberId] Params:", req.params);

  try {
    const { memberId } = req.params;
    const m = await Member.findByIdAndDelete(memberId).lean();
    if (!m) {
      console.log("[DELETE /memberships/:memberId] Membership not found");
      return res.status(404).json({ error: "Membership not found" });
    }

    console.log("[DELETE /memberships/:memberId] Deleted membership:", memberId);

    await Person.updateOne(
      { _id: m.person },
      { $pull: { communityIds: m.community } }
    );

    req.io?.to(ROOM(m.community)).emit("members:changed", {
      communityId: String(m.community),
      action: "delete",
      memberId: String(m._id),
    });
    req.io?.emit("admin:membershipChanged", {
      action: "delete",
      memberId: String(m._id),
    });

    res.json({ message: "Removed" });
  } catch (e) {
    console.error("💥 DELETE /api/admin/memberships/:memberId ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/people/:id
router.delete("/people/:id", async (req, res) => {
  console.log("📡 [DELETE /api/admin/people/:id] Params:", req.params);

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      console.log("[DELETE /people/:id] Invalid user id:", id);
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (String(id) === String(req.user.id)) {
      console.log("[DELETE /people/:id] Attempt to delete self:", id);
      return res
        .status(400)
        .json({ error: "You cannot delete your own account." });
    }

    const target = await Person.findById(id).select("_id role").lean();
    if (!target) {
      console.log("[DELETE /people/:id] User not found:", id);
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role === "admin") {
      const adminsLeft = await Person.countDocuments({
        role: "admin",
        _id: { $ne: id },
      });
      if (adminsLeft === 0) {
        console.log(
          "[DELETE /people/:id] Attempt to delete last remaining admin"
        );
        return res
          .status(400)
          .json({ error: "Cannot delete the last remaining admin." });
      }
    }

    const removedMemberships = await Member.find({ person: id })
      .select("_id community")
      .lean();
    await Member.deleteMany({ person: id });

    await Person.findByIdAndDelete(id);
    console.log("[DELETE /people/:id] Deleted user and memberships:", id);

    for (const m of removedMemberships) {
      req.io?.to(ROOM(m.community)).emit("members:changed", {
        communityId: String(m.community),
        action: "delete",
        memberId: String(m._id),
      });
    }

    req.io?.emit("admin:userChanged", {
      action: "delete",
      userId: String(id),
    });

    res.json({ message: "User deleted" });
  } catch (e) {
    console.error("💥 DELETE /api/admin/people/:id ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------------------------ *
 * Dating profile moderation
 * ------------------------------------------------------------------ */

router.get("/dating/profiles/pending", async (req, res) => {
  console.log("📡 [GET /api/admin/dating/profiles/pending] Query:", req.query);

  try {
    const { q = "", page = 1, limit = 50 } = req.query;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const baseFilter = {
      $or: [
        { isPhotoApproved: { $ne: true } },
        { isProfileVisible: { $ne: true } },
      ],
      isSuspended: { $ne: true },
    };

    console.log("[GET /dating/profiles/pending] Base filter:", baseFilter);

    const allProfiles = await DatingProfile.find(baseFilter)
      .sort({ createdAt: -1 })
      .populate({
        path: "person",
        select: "_id fullName email role collegeSlug religionKey",
      })
      .lean();

    console.log(
      "[GET /dating/profiles/pending] Found profiles:",
      allProfiles.length
    );

    let filtered = allProfiles;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtered = allProfiles.filter((p) => {
        const fullName = p.person?.fullName || "";
        const email = p.person?.email || "";
        return rx.test(fullName) || rx.test(email);
      });
      console.log(
        "[GET /dating/profiles/pending] After q filter:",
        filtered.length
      );
    }

    filtered = filtered.filter((p) => !!p.person);
    console.log(
      "[GET /dating/profiles/pending] After person exists filter:",
      filtered.length
    );

    const total = filtered.length;
    const start = (pg - 1) * lim;
    const pageItems = filtered.slice(start, start + lim);

    const items = pageItems.map((p) => ({
      _id: p._id,
      person: p.person?._id,
      personName: p.person?.fullName || p.person?.email || "Unknown",
      personEmail: p.person?.email || "",
      photos: p.photos || [],
      bio: p.bio || "",
      gender: p.gender || null,
      seeking: Array.isArray(p.seeking) ? p.seeking : [],
      yearOfStudy: p.yearOfStudy || null,
      isPhotoApproved: !!p.isPhotoApproved,
      isProfileVisible: !!p.isProfileVisible,
      isSuspended: !!p.isSuspended,
      createdAt: p.createdAt,
    }));

    console.log(
      "[GET /dating/profiles/pending] Returning",
      items.length,
      "items"
    );

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("💥 GET /api/admin/dating/profiles/pending ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/dating/profiles/:id/approve
router.patch("/dating/profiles/:id/approve", async (req, res) => {
  console.log(
    "📡 [PATCH /api/admin/dating/profiles/:id/approve] Params:",
    req.params
  );

  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      console.log("[PATCH /dating/profiles/:id/approve] Invalid profile id");
      return res.status(400).json({ error: "Invalid profile id" });
    }

    const profile = await DatingProfile.findByIdAndUpdate(
      id,
      {
        $set: {
          isPhotoApproved: true,
          isProfileVisible: true,
          isSuspended: false,
        },
      },
      { new: true }
    )
      .populate("person", "_id fullName email role collegeSlug religionKey")
      .lean();

    if (!profile) {
      console.log("[PATCH /dating/profiles/:id/approve] Profile not found");
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log(
      "[PATCH /dating/profiles/:id/approve] Approved profile:",
      profile._id
    );

    req.io?.emit("admin:datingProfileChanged", {
      action: "approve",
      profile,
    });

    res.json({ message: "Profile approved", profile });
  } catch (e) {
    console.error("💥 PATCH /api/admin/dating/profiles/:id/approve ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/dating/profiles/:id/suspend
router.patch("/dating/profiles/:id/suspend", async (req, res) => {
  console.log(
    "📡 [PATCH /api/admin/dating/profiles/:id/suspend] Params:",
    req.params
  );

  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      console.log("[PATCH /dating/profiles/:id/suspend] Invalid profile id");
      return res.status(400).json({ error: "Invalid profile id" });
    }

    const profile = await DatingProfile.findByIdAndUpdate(
      id,
      {
        $set: {
          isSuspended: true,
          isProfileVisible: false,
        },
      },
      { new: true }
    )
      .populate("person", "_id fullName email role collegeSlug religionKey")
      .lean();

    if (!profile) {
      console.log("[PATCH /dating/profiles/:id/suspend] Profile not found");
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log(
      "[PATCH /dating/profiles/:id/suspend] Suspended profile:",
      profile._id
    );

    req.io?.emit("admin:datingProfileChanged", {
      action: "suspend",
      profile,
    });

    res.json({ message: "Profile suspended", profile });
  } catch (e) {
    console.error("💥 PATCH /api/admin/dating/profiles/:id/suspend ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;