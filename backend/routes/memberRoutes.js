// backend/routes/memberRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

// All member routes are protected
router.use(authenticate);

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
/**
 * GET /api/members/:communityId
 * Returns members of a community (membership-gated).
 */
router.get("/:communityId", async (req, res) => {
  try {
    const { communityId } = req.params;

    // Ensure the community exists
    const community = await prisma.community.findUnique({
        where: { id: communityId },
        select: { id: true, name: true }
    });
    if (!community) return res.status(404).json({ error: "Community not found" });

    // Gate by membership of the requester
    const myMembership = await prisma.member.findUnique({
      where: {
          userId_communityId: { userId: req.user.id, communityId: communityId }
      }
    });
    if (!myMembership) {
      return res.status(403).json({ error: "You are not a member of this community" });
    }

    const q = (req.query.q || "").trim();
    const statusFilter = (req.query.status || "").toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500);
    const cursor = req.query.cursor || null;

    // Live presence
    const allOnlineUsers = new Set(
        global.onlineUsers ? global.onlineUsers.keys() : [] 
        // Note: req.presence.listOnlineUsers logic?
        // Code used: `req.presence?.listOnlineUsers?.()`
        // I will keep that logic.
    );
    // Let's reuse existing presence logic pattern
    const liveUsers = new Set(
        Array.isArray(req.presence?.listOnlineUsers?.())
            ? req.presence.listOnlineUsers()
            : []
    );

    const where = { communityId: communityId };
    
    // Search filter (on member fields OR user fields)
    // Prisma doesn't support OR across relations easily in one level without nested ORs.
    // simpler to search member.name/email/fullName since we copy those fields?
    // The previous code searched member.fullName/email OR person.fullName/email.
    // Our new Member table has fullName/email duplicated for optimization, so we can search local fields.
    if (q) {
        where.OR = [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } } // optional
        ];
    }
    
    // Note: statusFilter in Mongoose code was applied *after* fetching + presence check?
    // "const byPresence = statusFilter ... ? normalized.filter(...) : normalized"
    // So status 'online' is determined by Socket presence, not DB.
    // We fetch everything (paginated), then filter? 
    // Wait, if we paginate by DB, but filter by Presence (RAM), that breaks pagination if we only return online users.
    // The original code: fetched 'limit' members, then applied filter to that slice. 
    // This is quirky (you might get 0 results for page 1 if all are offline), but I will replicate it to be safe.
    
    const findArgs = {
        where,
        take: limit,
        orderBy: { id: 'asc' }, // consistent ordering for cursor
        include: {
            user: {
                select: { id: true, fullName: true, email: true, avatar: true }
            }
        }
    };
    
    if (cursor) {
        findArgs.cursor = { id: cursor };
        findArgs.skip = 1; // skip the cursor itself
    }

    const membersRaw = await prisma.member.findMany(findArgs);

    // Normalize
    const normalized = membersRaw.map((m) => {
      const p = m.user || null;

      // Fallback logic from original code, though Prisma fields should be populated if data is good.
      const displayName =
        (m.fullName || (p && p.fullName) || "").trim() ||
        (m.email || (p && p.email) || "").trim() ||
        "User";

      // Use user.email / avatar as primary if available, or member's cached copy
      const email = (m.email || (p && p.email) || "").trim() || undefined;
      const avatar = m.avatar || (p && p.avatar) || "/default-avatar.png";

      const personId = p ? p.id : m.userId;
      const isOnline = personId ? liveUsers.has(personId) : false;

      return {
        _id: m.id, // Compat
        id: m.id,
        person: personId || null,
        community: m.communityId, // string
        fullName: displayName,
        email,
        avatar,
        status: isOnline ? "online" : "offline",
        memberStatus: m.memberStatus, 
        role: m.role,
        isYou: personId === req.user.id,
      };
    });

    const byPresence =
      statusFilter === "online" || statusFilter === "offline"
        ? normalized.filter((x) => x.status === statusFilter)
        : normalized;

    // The original code did regex filter on "normalized" items if q was present but we did DB filter.
    // Since we did DB filter, 'filtered' should be same as 'byPresence'.
    // Except complex "name or email" logic. DB filter covered it.
    
    const nextCursor = membersRaw.length === limit ? membersRaw[membersRaw.length - 1].id : null;

    return res.json({
      items: byPresence,
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
/**
 * POST /api/members
 * Upsert your membership into a community.
 */
router.post("/", async (req, res) => {
  try {
    const { community, fullName, avatar } = req.body || {};
    // Note: community here is the ID string from body
    if (!community) {
      return res.status(400).json({ error: "Valid community id is required" });
    }

    const comm = await prisma.community.findUnique({
        where: { id: community }
    });
    if (!comm) return res.status(404).json({ error: "Community not found" });

    const me = await prisma.user.findUnique({
        where: { id: req.user.id }
    });
    if (!me) return res.status(401).json({ error: "User not found" });

    // Upsert
    const memberData = {
        userId: me.id,
        communityId: comm.id,
        name: (fullName || me.fullName || me.email || "User").trim(),
        fullName: (fullName || me.fullName || me.email || "User").trim(),
        email: me.email,
        avatar: avatar || me.avatar || "/default-avatar.png",
        role: "member",
        memberStatus: "active"
    };

    // We use a transaction or just upsert.
    // If we want to ONLY set some fields on insert ($setOnInsert equivalent), 
    // we put them in `create` but omit from `update`.
    // The original code:
    // $setOnInsert: { person, community }
    // $set: { fullName, email, avatar } <-- these ARE updated on every post?
    // Wait, original code:
    /*
      $setOnInsert: { person: me._id, community: community },
      $set: {
          fullName: ...,
          email: ...,
          avatar: ...
      }
    */
    // So distinct from login logic? 
    // Yes, this route lets you "join" or "update profile in community".
    
    // Prisma upsert:
    const updated = await prisma.member.upsert({
        where: {
            userId_communityId: { userId: me.id, communityId: comm.id }
        },
        create: memberData,
        update: {
            fullName: memberData.fullName,
            name: memberData.name,
            email: memberData.email,
            avatar: memberData.avatar,
            memberStatus: "active" // Ensure active if re-joining
        }
    });

    // Notify members in this room that membership changed
    req.io?.to(ROOM(comm.id)).emit("members:changed", {
      communityId: String(comm.id),
      action: "upsert",
      member: updated,
    });

    return res.status(201).json({ ...updated, _id: updated.id });
  } catch (error) {
    console.error("POST /api/members error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * PATCH /api/members/:memberId
 * Update your own membership record.
 */
router.patch("/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const { fullName, avatar, status } = req.body || {};
    const data = {};
    
    if (typeof fullName === "string") {
        data.fullName = fullName.trim();
        data.name = fullName.trim(); // sync name field
    }
    if (typeof avatar === "string") data.avatar = avatar.trim();
    if (typeof status === "string" && ["online", "offline"].includes(status)) {
      // data.status = status; // We don't store 'status' (online/offline) in DB usually, that's presence.
      // But maybe original code did?
      // Mongoose schema has `status` or `memberStatus`?
      // Original code: $set.status = status.
      // Prisma schema: `memberStatus` (active/inactive) vs `status`?
      // Let's check schema.
      // Schema has `memberStatus` (String).
      // Does it have `status`? No.
      // Original Mongoose model likely had `status` for presence if not ephemeral?
      // Or maybe `status` = 'active'?
      // Original code check: `["online", "offline"].includes(status)`.
      // This suggests it WAS storing online/offline in DB?
      // If so, we should map it to something or ignore if we strictly use Redis/Socket for presence.
      // My Prisma schema does NOT have an `onlineStatus` field.
      // I will ignore it for now or assume it's ephemeral and handled by socket only.
      // NOTE: Clients might expect it to persist?
      // "status: isOnline ? 'online' : 'offline'" in GET suggests it is derived.
      // So updating it in DB might be useless legacy behavior unless it overrides presence?
      // I'll skip DB update for 'status' unless I see a column.
    }
    
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Ensure the member belongs to the current user
    // We can check ownership in WHERE clause
    // But we need to find unique by ID first to be safe, or just updateMany?
    // updateMany returns count.
    
    // Better: findUnique first to check ownership, then update?
    // Or `update` if ID is PK.
    // Member PK is ID.
    
    const existing = await prisma.member.findUnique({ where: { id: memberId } });
    if (!existing || existing.userId !== req.user.id) {
        return res.status(404).json({ error: "Member not found or not owned by you" });
    }
    
    const member = await prisma.member.update({
        where: { id: memberId },
        data: data
    });

    req.io?.to(ROOM(member.communityId)).emit("members:changed", {
      communityId: String(member.communityId),
      action: "update",
      member,
    });

    return res.json({ ...member, _id: member.id });
  } catch (error) {
    console.error("PATCH /api/members/:memberId error:", error);
    if (error?.code === 'P2025') return res.status(404).json({ error: "Member not found" });
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * DELETE /api/members/:memberId
 * Leave a community (your own membership).
 */
router.delete("/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify ownership
    const existing = await prisma.member.findUnique({ where: { id: memberId } });
    if (!existing || existing.userId !== req.user.id) {
        return res.status(404).json({ error: "Member not found or not owned by you" });
    }

    const removed = await prisma.member.delete({
        where: { id: memberId }
    });

    req.io?.to(ROOM(removed.communityId)).emit("members:changed", {
      communityId: String(removed.communityId),
      action: "delete",
      memberId: String(removed.id),
    });

    return res.json({ message: "Member removed" });
  } catch (error) {
    console.error("DELETE /api/members/:memberId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;