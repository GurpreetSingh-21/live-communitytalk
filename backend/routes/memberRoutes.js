// backend/routes/memberRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Member = require("../models/Member");
const Community = require("../models/Community");
const Person = require("../person");
const authenticate = require("../middleware/authenticate");

// All member routes are protected
router.use(authenticate);

const isValidId = (id) => mongoose.isValidObjectId(id);
const ROOM = (id) => `community:${id}`;

/**
 * GET /api/members/:communityId
 * Returns members of a community (membership-gated).
 * Query:
 *   ?q=term                (filter by name/email)
 *   ?status=online|offline (presence filter)
 *   ?limit=50              (pagination; default 200)
 *   ?cursor=<memberId>     (pagination cursor; returns after this _id)
 */
router.get("/:communityId", async (req, res) => {
  try {
    const { communityId } = req.params;
    if (!isValidId(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }

    // Ensure the community exists
    const community = await Community.findById(communityId).select("_id name").lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    // Gate by membership of the requester (existence is enough)
    const youAreMember = await Member.exists({
      person: req.user.id,
      community: communityId,
    });
    if (!youAreMember) {
      return res.status(403).json({ error: "You are not a member of this community" });
    }

    const q = (req.query.q || "").trim();
    const statusFilter = (req.query.status || "").toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500);
    const cursor = req.query.cursor && isValidId(req.query.cursor) ? req.query.cursor : null;

    // Build query
    const findQuery = { community: communityId };
    if (cursor) {
      // pagination by _id
      findQuery._id = { $gt: cursor };
    }

    // Load members + joined Person fields
    const membersRaw = await Member.find(findQuery)
      .select("_id person fullName email status avatar community")
      .populate({
        path: "person",
        model: "Person",
        select: "_id fullName email avatar",
      })
      .sort({ _id: 1 })
      .limit(limit)
      .lean();

    // Live presence helpers
  const allOnlineUsers = new Set(
  Array.isArray(req.presence?.listOnlineUsers?.())
    ? req.presence.listOnlineUsers()
    : []
);

    // Normalize
    const normalized = membersRaw.map((m) => {
      const p = m.person || null;

      const displayName =
        (m.fullName || (p && p.fullName) || "").trim() ||
        (m.email || (p && p.email) || "").trim() ||
        "User";

      const email = (m.email || (p && p.email) || "").trim() || undefined;
      const avatar = m.avatar || (p && p.avatar) || "/default-avatar.png";

      const personId = String(p?._id || m.person || "");
      const isOnline = personId ? allOnlineUsers.has(personId) : false;

      return {
        _id: m._id,
        person: personId || null,
        community: String(m.community),
        fullName: displayName,
        email,
        avatar,
        status: isOnline ? "online" : "offline", // live status for UI
        isYou: personId === String(req.user.id),
      };
    });

    // Presence filter
    const byPresence =
      statusFilter === "online" || statusFilter === "offline"
        ? normalized.filter((x) => x.status === statusFilter)
        : normalized;

    // Search filter
    const rx = q ? new RegExp(q, "i") : null;
    const filtered = rx
      ? byPresence.filter(
          (x) => rx.test(x.fullName || "") || rx.test(x.email || "")
        )
      : byPresence;

    // next cursor
    const nextCursor = membersRaw.length ? String(membersRaw[membersRaw.length - 1]._id) : null;

    // Keep shape compatible with frontend (Home.jsx handles both array and {items})
    return res.json({
      items: filtered,
      nextCursor,
      hasMore: membersRaw.length === limit,
    });
  } catch (error) {
    console.error("GET /api/members/:communityId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * POST /api/members
 * Upsert your membership into a community.
 * Body: { community, fullName?, avatar? }
 * Emits: "members:changed" to the community room on success.
 */
router.post("/", async (req, res) => {
  try {
    const { community, fullName, avatar } = req.body || {};
    if (!community || !isValidId(community)) {
      return res.status(400).json({ error: "Valid community id is required" });
    }

    const comm = await Community.findById(community).select("_id").lean();
    if (!comm) return res.status(404).json({ error: "Community not found" });

    const me = await Person.findById(req.user.id)
      .select("_id fullName email avatar")
      .lean();
    if (!me) return res.status(401).json({ error: "User not found" });

    // Important: identity fields only in $setOnInsert; display fields in $set
    const updated = await Member.findOneAndUpdate(
      { person: me._id, community: community },
      {
        $setOnInsert: { person: me._id, community: community },
        $set: {
          fullName: (fullName || me.fullName || me.email || "User").trim(),
          email: me.email,
          avatar: avatar || me.avatar || "/default-avatar.png",
        },
      },
      { new: true, upsert: true }
    )
      .select("_id person fullName email status avatar community")
      .lean();

    // Notify members in this room that membership changed
    req.io?.to(ROOM(community)).emit("members:changed", {
      communityId: String(community),
      action: "upsert",
      member: updated,
    });

    return res.status(201).json(updated);
  } catch (error) {
    console.error("POST /api/members error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * PATCH /api/members/:memberId
 * Update your own membership record.
 * Body: { fullName?, avatar?, status? }  (status is optional manual flag)
 * Emits: "members:changed" to community room.
 */
router.patch("/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!isValidId(memberId)) {
      return res.status(400).json({ error: "Invalid memberId" });
    }

    const { fullName, avatar, status } = req.body || {};
    const $set = {};
    if (typeof fullName === "string") $set.fullName = fullName.trim();
    if (typeof avatar === "string") $set.avatar = avatar.trim();
    if (typeof status === "string" && ["online", "offline"].includes(status)) {
      $set.status = status;
    }
    if (!Object.keys($set).length) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Ensure the member belongs to the current user
    const member = await Member.findOneAndUpdate(
      { _id: memberId, person: req.user.id },
      { $set },
      { new: true }
    )
      .select("_id person fullName email status avatar community")
      .lean();

    if (!member) {
      return res.status(404).json({ error: "Member not found or not owned by you" });
    }

    req.io?.to(ROOM(member.community)).emit("members:changed", {
      communityId: String(member.community),
      action: "update",
      member,
    });

    return res.json(member);
  } catch (error) {
    console.error("PATCH /api/members/:memberId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * DELETE /api/members/:memberId
 * Leave a community (your own membership).
 * Emits: "members:changed" to community room.
 */
router.delete("/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!isValidId(memberId)) {
      return res.status(400).json({ error: "Invalid memberId" });
    }

    const removed = await Member.findOneAndDelete({
      _id: memberId,
      person: req.user.id,
    }).lean();

    if (!removed) {
      return res.status(404).json({ error: "Member not found or not owned by you" });
    }

    req.io?.to(ROOM(removed.community)).emit("members:changed", {
      communityId: String(removed.community),
      action: "delete",
      memberId: String(removed._id),
    });

    return res.json({ message: "Member removed" });
  } catch (error) {
    console.error("DELETE /api/members/:memberId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;