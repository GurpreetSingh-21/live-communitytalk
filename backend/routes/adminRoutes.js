// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/requireAdmin");
const Person = require("../person");
const Community = require("../models/Community");
const Member = require("../models/Member");

const ROOM = (id) => `community:${id}`;
const slugify = (s = "") =>
  String(s).toLowerCase().trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");

// Admin-only
router.use(authenticate, requireAdmin);

/* ------------------------------------------------------------------ *
 * Communities: list / create / update / delete
 * ------------------------------------------------------------------ */

// GET /api/admin/communities?q=&type=&page=&limit=&includePrivate=true|false
router.get("/communities", async (req, res) => {
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

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("GET /api/admin/communities", e);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/communities
// body: { name, type: "college"|"religion"|"custom", key?, isPrivate?, tags?[], collegeId?, collegeKey? }
router.post("/communities", async (req, res) => {
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

    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!["college", "religion", "custom"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    // --- Colleges ---
    if (type === "college") {
      const k = key?.trim() || slugify(name);
      const created = await Community.create({
        name: name.trim(),
        type,
        key: k,
        isPrivate: !!isPrivate,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        createdBy: req.user.id,
      });

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

    // --- Religions (optionally attached to a college) ---
    if (type === "religion") {
      const religionName = name.trim();
      const religionKey = slugify(key?.trim() || religionName);

      let finalName = religionName;
      let finalKey = religionKey;
      const tagset = new Set(Array.isArray(tags) ? tags.slice(0, 10) : []);

      if (collegeId || collegeKey) {
        const colFilter = collegeId
          ? { _id: collegeId }
          : { key: slugify(collegeKey) };
        const college = await Community.findOne({
          ...colFilter,
          type: "college",
        }).lean();
        if (!college) return res.status(400).json({ error: "College not found" });

        // Pretty name + per-college unique key
        finalName = `${religionName} @ ${college.name}`;
        finalKey = `${college.key}__${religionKey}`;
        tagset.add(`college:${college.key}`);
      }

      const created = await Community.create({
        name: finalName,
        type,
        key: finalKey,
        isPrivate: !!isPrivate,
        tags: Array.from(tagset).slice(0, 10),
        createdBy: req.user.id,
      });

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

    // --- Custom groups ---
    if (type === "custom") {
      const k = key?.trim() || slugify(name);
      const created = await Community.create({
        name: name.trim(),
        type,
        key: k,
        isPrivate: !!isPrivate,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        createdBy: req.user.id,
      });

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
    console.error("POST /api/admin/communities", e);
    if (e?.code === 11000) return res.status(400).json({ error: "Duplicate (type,key) or slug" });
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/communities/:id  { name?, key?, isPrivate?, tags?[] }
router.patch("/communities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) update.name = req.body.name.trim();
    if (typeof req.body.key === "string") update.key = req.body.key.trim();
    if (typeof req.body.isPrivate === "boolean") update.isPrivate = req.body.isPrivate;
    if (Array.isArray(req.body.tags)) update.tags = req.body.tags.slice(0, 10);

    const saved = await Community.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select("_id name type key slug isPrivate tags")
      .lean();
    if (!saved) return res.status(404).json({ error: "Not found" });

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
    console.error("PATCH /api/admin/communities/:id", e);
    if (e?.code === 11000) return res.status(400).json({ error: "Duplicate (type,key) or slug" });
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/communities/:id
router.delete("/communities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cc = await Community.findByIdAndDelete(id).lean();
    if (!cc) return res.status(404).json({ error: "Not found" });

    await Member.deleteMany({ community: id });

    req.io?.emit("admin:communityChanged", { action: "delete", communityId: String(id) });
    req.io?.to(ROOM(id)).emit("community:deleted", { communityId: String(id) });

    res.json({ message: "Deleted" });
  } catch (e) {
    console.error("DELETE /api/admin/communities/:id", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------------------------ *
 * People: list / update
 * ------------------------------------------------------------------ */

// GET /api/admin/people?q=&page=&limit=
router.get("/people", async (req, res) => {
  try {
    const { q = "", page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: rx }, { email: rx }];
    }

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

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("GET /api/admin/people", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/people/:id  { fullName?, email?, role? }
router.patch("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = {};
    if (typeof req.body.fullName === "string") update.fullName = req.body.fullName.trim();
    if (typeof req.body.email === "string") update.email = req.body.email.trim().toLowerCase();
    if (typeof req.body.role === "string") {
      if (!["user", "mod", "admin"].includes(req.body.role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      update.role = req.body.role;
    }

    const saved = await Person.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select("_id fullName email role communityIds")
      .lean();
    if (!saved) return res.status(404).json({ error: "Not found" });

    req.io?.emit("admin:userChanged", { action: "update", user: saved });
    res.json(saved);
  } catch (e) {
    console.error("PATCH /api/admin/people/:id", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------------------------ *
 * Membership ops: add / remove
 * ------------------------------------------------------------------ */

// POST /api/admin/memberships { personId, communityId }
router.post("/memberships", async (req, res) => {
  try {
    const { personId, communityId } = req.body || {};
    if (!mongoose.isValidObjectId(personId) || !mongoose.isValidObjectId(communityId)) {
      return res.status(400).json({ error: "Invalid ids" });
    }

    const [person, community] = await Promise.all([
      Person.findById(personId).select("_id fullName email avatar").lean(),
      Community.findById(communityId).select("_id name").lean(),
    ]);
    if (!person || !community) return res.status(404).json({ error: "User or community not found" });

    const member = await Member.findOneAndUpdate(
      { person: person._id, community: community._id },
      {
        $setOnInsert: { person: person._id, community: community._id, status: "active", role: "member" },
        $set: { name: person.fullName || person.email, email: person.email, avatar: person.avatar || "/default-avatar.png" },
      },
      { new: true, upsert: true }
    ).lean();

    await Person.updateOne({ _id: person._id }, { $addToSet: { communityIds: community._id } });

    req.io?.to(ROOM(communityId)).emit("members:changed", {
      communityId: String(communityId),
      action: "upsert",
      member,
    });
    req.io?.emit("admin:membershipChanged", { action: "upsert", member });

    res.status(201).json(member);
  } catch (e) {
    console.error("POST /api/admin/memberships", e);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/memberships/:memberId
router.delete("/memberships/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const m = await Member.findByIdAndDelete(memberId).lean();
    if (!m) return res.status(404).json({ error: "Membership not found" });

    await Person.updateOne({ _id: m.person }, { $pull: { communityIds: m.community } });

    req.io?.to(ROOM(m.community)).emit("members:changed", {
      communityId: String(m.community),
      action: "delete",
      memberId: String(m._id),
    });
    req.io?.emit("admin:membershipChanged", { action: "delete", memberId: String(m._id) });

    res.json({ message: "Removed" });
  } catch (e) {
    console.error("DELETE /api/admin/memberships/:memberId", e);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/people/:id  { hard?=true }
// - Prevent deleting yourself or the last remaining admin
router.delete("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (String(id) === String(req.user.id)) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    const target = await Person.findById(id).select("_id role").lean();
    if (!target) return res.status(404).json({ error: "User not found" });

    // If deleting an admin, ensure at least one admin remains
    if (target.role === "admin") {
      const adminsLeft = await Person.countDocuments({ role: "admin", _id: { $ne: id } });
      if (adminsLeft === 0) {
        return res.status(400).json({ error: "Cannot delete the last remaining admin." });
      }
    }

    // Remove memberships for this user
    const removedMemberships = await Member.find({ person: id }).select("_id community").lean();
    await Member.deleteMany({ person: id });

    // Remove the user
    await Person.findByIdAndDelete(id);

    // Notify rooms impacted by membership removals
    for (const m of removedMemberships) {
      req.io?.to(ROOM(m.community)).emit("members:changed", {
        communityId: String(m.community),
        action: "delete",
        memberId: String(m._id),
      });
    }

    // Global admin event
    req.io?.emit("admin:userChanged", { action: "delete", userId: String(id) });

    res.json({ message: "User deleted" });
  } catch (e) {
    console.error("DELETE /api/admin/people/:id", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;