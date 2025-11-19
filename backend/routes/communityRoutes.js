// backend/routes/communityRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const Community = require("../models/Community");
const Member = require("../models/Member");
const Person = require("../person");

// All routes require a valid JWT (server also mounts with authenticate)
router.use(authenticate);

/* ───────────────── helpers ───────────────── */

function isAdmin(req) {
  return !!(req?.user?.isAdmin || String(req?.user?.role || "").toLowerCase() === "admin");
}

/**
 * Upsert a membership in a schema-safe way (handles legacy unique index collisions).
 * Mirrors the approach used in loginNregRoutes.js, but updated for new Member schema.
 */
async function upsertMembership({ session, person, community }) {
  const baseSet = {
    person: person._id,
    community: community._id,
    name: person.fullName || person.email,
    email: person.email,
    avatar: person.avatar || "/default-avatar.png",
    memberStatus: "active",
    role: "member",
  };

  try {
    // Normal path: upsert on canonical fields only
    let m = await Member.findOneAndUpdate(
      { person: person._id, community: community._id },
      {
        $set: baseSet,
        $setOnInsert: {
          // For legacy deployments that still have a personId_1_communityId_1 unique index
          personId: person._id,
          communityId: community._id,
        },
      },
      {
        new: true,
        upsert: true,
        session,
        setDefaultsOnInsert: true,
        strict: false, // allow legacy fields personId/communityId
      }
    )
      .select("_id person community name email avatar memberStatus role")
      .lean();

    if (m && !m.fullName && m.name) {
      m.fullName = m.name; // keep old consumers happy
    }

    // Reflect on Person
    await Person.updateOne(
      { _id: person._id },
      { $addToSet: { communityIds: community._id } },
      { session }
    );

    return m;
  } catch (err) {
    // If legacy unique idx (personId_1_communityId_1) collides, upgrade that doc
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

        let upgraded = await Member.findById(legacy._id)
          .select("_id person community name email avatar memberStatus role")
          .lean();

        if (upgraded && !upgraded.fullName && upgraded.name) {
          upgraded.fullName = upgraded.name;
        }

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

/* ───────────────── routes ───────────────── */

/**
 * POST /api/communities
 * Admin-only: create a new community and (optionally) add creator as owner member.
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

    // Create community (defaults to type "custom" per schema)
    const community = await Community.create({
      name: name.trim(),
      description: (description || "").trim(),
      createdBy: personId,
    });

    // Make the admin an owner member as well
    await Member.create({
      person: personId,
      community: community._id,
      name: creator.fullName || creator.email || "User",
      email: creator.email,
      avatar: creator.avatar || "/default-avatar.png",
      role: "owner",
      memberStatus: "active",
    });

    return res.status(201).json({
      _id: community._id,
      name: community.name,
      description: community.description,
      createdBy: community.createdBy,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
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
      ? {
          name: {
            $regex: new RegExp(qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          },
        }
      : {};

    const projection =
      "_id name description type key slug isPrivate tags createdBy createdAt updatedAt";

    if (wantPaginated) {
      const [items, total] = await Promise.all([
        Community.find(filter)
          .select(projection)
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
      .select(projection)
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
 * Stub unread count to satisfy app calls (replace with real logic later).
 */
router.get("/:id/unread", async (_req, res) => {
  try {
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
 * Admin-only delete. Also removes Member rows for that community.
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
      // Optional: cascade messages if you add that model
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
 * Join a community (idempotent, safe with legacy indexes).
 */
router.post("/:id/join", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const personId = req.user?.id;
    const { id } = req.params;

    if (!personId) return res.status(401).json({ error: "Unauthorized" });

    const [community, me] = await Promise.all([
      Community.findById(id).lean(),
      Person.findById(personId).select("_id fullName email avatar").lean(),
    ]);

    if (!community) return res.status(404).json({ error: "Community not found" });
    if (!me) return res.status(401).json({ error: "User not found" });

    // Already a member? return OK
    const exists = await Member.findOne({ person: personId, community: id }).lean();
    if (exists) return res.status(200).json({ message: "Already a member" });

    let membership;

    await session.withTransaction(async () => {
      membership = await upsertMembership({ session, person: me, community });
    });

    // Realtime: notify this user’s clients (if socket layer present)
    try {
      req.io?.to(String(req.user.id)).emit("membership:joined", {
        userId: String(req.user.id),
        communityId: String(community._id),
      });
      // Presence helper if you want:
      req.presence?.joinCommunity?.(String(req.user.id), String(community._id));
    } catch {
      // ignore socket errors
    }

    return res.status(201).json(membership || { message: "Joined" });
  } catch (error) {
    console.error("POST /api/communities/:id/join error:", error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    session.endSession();
  }
});

/**
 * POST /api/communities/:id/leave
 * Leave a community (idempotent-ish).
 */
router.post("/:id/leave", async (req, res) => {
  try {
    const personId = req.user?.id;
    const { id } = req.params;

    if (!personId) return res.status(401).json({ error: "Unauthorized" });

    const community = await Community.findById(id).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    const membership = await Member.findOne({ person: personId, community: id });
    if (!membership) {
      return res.status(404).json({ error: "Not a member of this community" });
    }

    await membership.deleteOne();

    // Realtime: notify clients
    try {
      req.io?.to(String(req.user.id)).emit("membership:left", {
        userId: String(req.user.id),
        communityId: String(community._id),
      });
      req.presence?.leaveCommunity?.(String(req.user.id), String(community._id));
    } catch {
      // ignore socket errors
    }

    // Optional: also $pull from Person.communityIds to keep tidy
    try {
      await Person.updateOne(
        { _id: personId },
        { $pull: { communityIds: community._id } }
      );
    } catch {
      // ignore
    }

    return res.status(200).json({ message: "Left community" });
  } catch (error) {
    console.error("POST /api/communities/:id/leave error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;