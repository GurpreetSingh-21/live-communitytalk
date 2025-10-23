// backend/routes/communityRoutes.js
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const Community = require("../models/Community");
const Member = require("../models/Member");
const Person = require("../person");
// Optional: if/when you implement real unread counts
// const Message = require("../models/Message");

// All routes require a valid JWT (belt & suspenders; server also mounts with authenticate)
router.use(authenticate);

/** Helpers */
function isAdmin(req) {
  const role = req.user?.role || req.user?.isAdmin ? "admin" : req.user?.role;
  return String(role).toLowerCase() === "admin";
}

/**
 * POST /api/communities
 * Admin-only: create a new community and (optionally) add creator as member.
 * Body: { name, description? }
 */
router.post("/", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admins can create communities" });
    }

    const personId = req.user?.id;
    if (!personId) return res.status(401).json({ error: "Unauthorized" });

    const { name, description = "" } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Community name is required" });
    }

    // Duplicate name check (case-insensitive)
    const dup = await Community.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    }).lean();
    if (dup) return res.status(400).json({ error: "Community name already exists" });

    // Creator must exist
    const creator = await Person.findById(personId)
      .select("_id fullName email avatar")
      .lean();
    if (!creator) return res.status(404).json({ error: "Creator not found" });

    // Create community
    const community = await Community.create({
      name: name.trim(),
      description: (description || "").trim(),
      createdBy: personId,
    });

    // Make the admin a member as well (optional but handy)
    const member = await Member.create({
      person: personId,
      community: community._id,
      status: "online",
      fullName: creator.fullName || creator.email || "User",
      email: creator.email,
      avatar: creator.avatar || "/default-avatar.png",
      role: "owner",
    });

    return res.status(201).json({
      _id: community._id,
      name: community.name,
      description: community.description,
      createdBy: community.createdBy,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
      creatorMemberId: member._id,
    });
  } catch (error) {
    console.error("POST /api/communities error:", error);
    if (error?.code === 11000) {
      return res.status(400).json({ error: "Community name already exists" });
    }
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/communities
 * List communities (optional search + pagination)
 * Query: ?q=term&page=1&limit=20&paginated=true
 */
router.get("/", async (req, res) => {
  try {
    const qRaw = (req.query.q || "").trim();
    const wantPaginated =
      String(req.query.paginated || "").toLowerCase() === "1" ||
      String(req.query.paginated || "").toLowerCase() === "true";

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const filter = qRaw
      ? { name: { $regex: new RegExp(qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } }
      : {};

    if (wantPaginated) {
      const [items, total] = await Promise.all([
        Community.find(filter)
          .select("_id name description createdBy createdAt updatedAt")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Community.countDocuments(filter),
      ]);
      return res.status(200).json({
        items,
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      });
    }

    const items = await Community.find(filter)
      .select("_id name description createdBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(items);
  } catch (error) {
    console.error("GET /api/communities error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/communities/:id
 * Fetch one community
 */
router.get("/:id", async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });
    return res.status(200).json(community);
  } catch (error) {
    console.error("GET /api/communities/:id error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/communities/:id/unread
 * Provide unread count for this user in a given community.
 * For now returns { count: 0 } to satisfy the app calls and avoid 404s.
 * Replace with real logic when you track read receipts.
 */
router.get("/:id/unread", async (req, res) => {
  try {
    // Example real logic (pseudo):
    // const userId = req.user.id;
    // const count = await Message.countDocuments({
    //   communityId: req.params.id,
    //   "readBy.user": { $ne: userId },
    // });
    // return res.json({ count });

    return res.json({ count: 0 });
  } catch (error) {
    console.error("GET /api/communities/:id/unread error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * PATCH /api/communities/:id
 * Admin-only update.
 * Body: { name?, description? }
 */
router.patch("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admins can update communities" });
    }

    const { id } = req.params;

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const updates = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) {
      const dup = await Community.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${req.body.name.trim()}$`, "i") },
      }).lean();
      if (dup) return res.status(400).json({ error: "Community name already exists" });
      updates.name = req.body.name.trim();
    }
    if (typeof req.body.description === "string") {
      updates.description = req.body.description.trim();
    }

    const saved = await Community.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    return res.status(200).json(saved);
  } catch (error) {
    console.error("PATCH /api/communities/:id error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * DELETE /api/communities/:id
 * Admin-only delete.
 * Also removes Member rows for that community.
 */
router.delete("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admins can delete communities" });
    }

    const { id } = req.params;

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    await Promise.all([
      Community.findByIdAndDelete(id),
      Member.deleteMany({ community: id }),
      // Optional: cascade messages, if desired:
      // Message.deleteMany({ community: id }),
    ]);

    return res.status(200).json({ message: "Community deleted" });
  } catch (error) {
    console.error("DELETE /api/communities/:id error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/communities/:id/join
 * Join a community (idempotent)
 */
router.post("/:id/join", async (req, res) => {
  try {
    const personId = req.user?.id;
    const { id } = req.params;

    const community = await Community.findById(id).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    const exists = await Member.findOne({ person: personId, community: id }).lean();
    if (exists) {
      return res.status(200).json({ message: "Already a member" });
    }

    const me = await Person.findById(personId)
      .select("_id fullName email avatar")
      .lean();
    if (!me) return res.status(401).json({ error: "User not found" });

    const created = await Member.create({
      person: personId,
      community: id,
      status: "online",
      fullName: me.fullName || me.email || "User",
      email: me.email,
      avatar: me.avatar || "/default-avatar.png",
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error("POST /api/communities/:id/join error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * POST /api/communities/:id/leave
 * Leave a community.
 */
router.post("/:id/leave", async (req, res) => {
  try {
    const personId = req.user?.id;
    const { id } = req.params;

    const community = await Community.findById(id).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    const membership = await Member.findOne({ person: personId, community: id });
    if (!membership) {
      return res.status(404).json({ error: "Not a member of this community" });
    }

    await membership.deleteOne();

    return res.status(200).json({ message: "Left community" });
  } catch (error) {
    console.error("POST /api/communities/:id/leave error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;