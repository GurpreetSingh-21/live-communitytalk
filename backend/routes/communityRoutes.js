// backend/routes/communityRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

// All routes require a valid JWT (server also mounts with authenticate)
router.use(authenticate);

/* ───────────────── helpers ───────────────── */

/**
 * 🚀 PERFORMANCE: Invalidate threads cache for a user
 */
async function invalidateThreadsCache(req, userId) {
  if (req.redisClient) {
    try {
      const cacheKey = `threads:${userId}`;
      await req.redisClient.del(cacheKey);
      console.log(`[CACHE] Invalidated threads cache for user ${userId}`);
    } catch (err) {
      console.warn('[CACHE] Threads invalidation failed:', err);
    }
  }
}

/**
 * 🚀 PERFORMANCE: Invalidate member cache for a community
 */
async function invalidateMemberCache(req, communityId) {
  if (req.redisClient) {
    try {
      const pattern = `members:${communityId}:*`;
      const keys = await req.redisClient.keys(pattern);
      if (keys.length > 0) {
        await req.redisClient.del(...keys);
        console.log(`[CACHE] Invalidated ${keys.length} member cache entries for ${communityId}`);
      }
    } catch (err) {
      console.warn('[CACHE] Member invalidation failed:', err);
    }
  }
}

function isAdmin(req) {
  return !!(req?.user?.isAdmin || String(req?.user?.role || "").toLowerCase() === "admin");
  return !!(req?.user?.isAdmin || String(req?.user?.role || "").toLowerCase() === "admin");
}

/**
 * Upsert a membership in a schema-safe way.
 * Uses Prisma's upsert to handle userId_communityId uniqueness.
 */
async function upsertMembership({ tx, user, communityId }) {
  const memberData = {
    userId: user.id,
    communityId: communityId,
    name: user.fullName || user.email || "User",
    avatar: user.avatar || "/default-avatar.png",
    memberStatus: "active",
    role: "member",
  };

  // Upsert member
  // Note: schema must have @@unique([userId, communityId]) for this to work elegantly
  // which we defined in schema.prisma as @@unique([userId, communityId])
  const member = await (tx || prisma).member.upsert({
    where: {
      userId_communityId: { userId: user.id, communityId: communityId }
    },
    update: {
      memberStatus: "active",
    },
    create: memberData,
  });

  return member;
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

    const { name, description = "" } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Community name is required" });
    }

    // Check duplicate name
    // Using simple findFirst. We relies on case-insensitivity logic being handled manually 
    // or by DB collation. For now, strict match or manual lower case check.
    // Mongoose code had regex.
    const dup = await prisma.community.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } }
    });

    if (dup) return res.status(400).json({ error: "Community name already exists" });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ error: "Creator not found" });

    // Transaction to create community + owner member
    const result = await prisma.$transaction(async (tx) => {
      const comm = await tx.community.create({
        data: {
          name: name.trim(),
          description: (description || "").trim(),
          type: "custom",
          createdBy: user.id
        }
      });

      await tx.member.create({
        data: {
          userId: user.id,
          communityId: comm.id,
          name: user.fullName || user.email || "User",
          avatar: user.avatar || "/default-avatar.png",
          role: "owner",
          memberStatus: "active"
        }
      });
      return comm;
    });

    return res.status(201).json({
      _id: result.id,
      id: result.id,
      name: result.name,
      description: result.description,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: "Community name already exists" });
    }
    return res.status(500).json({ error: "Server Error" });
  }
});


/**
 * GET /api/communities/my-threads
 * Batch fetch for "Communities" tab (Threads view).
 * Returns: { items: [ { id, name, lastMsg, lastAt, memberCount, pinned, unread } ] }
 */
router.get("/my-threads", async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user.id;
    console.log(`[PERF] my-threads START for user ${userId}`);

    // 🚀 PERFORMANCE: Check Redis cache first (60s TTL)
    const cacheKey = `threads:${userId}`;
    if (req.redisClient) {
      try {
        const cached = await req.redisClient.get(cacheKey);
        if (cached) {
          console.log(`[CACHE HIT] Threads for user ${userId}`);
          return res.json(JSON.parse(cached));
        }
      } catch (cacheErr) {
        console.warn('[CACHE ERROR] Threads read failed:', cacheErr);
      }
    }

    // 1. Get all active memberships
    const t1 = Date.now();
    const members = await prisma.member.findMany({
      where: {
        userId,
        memberStatus: { in: ['active', 'owner'] }
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            imageUrl: true, // Include the image URL from admin uploads
            updatedAt: true,
            createdAt: true,
            // pinned: true, // Not in schema
            // The frontend code expects `c.pinned`. 
            // In typical systems, "pinning" is a user-specific action, stored on Member.
            // But if the schema puts it on Community, it's global.
            // Let's assume for now we use what's available. 
            // The frontend code: `pinned: !!c?.pinned` (from AuthContext communities) or `!!item.pinned` (local state).
            // Actually frontend uses `handlePinToggle` which updates LOCAL state only?
            // "onPinToggle" just updates local state. so server doesn't store it?
            // Wait, standard schema doesn't seem to have Pinned on Member.
          }
        }
      }
    });
    const t2 = Date.now();
    console.log(`[PERF] Members query: ${t2 - t1}ms, found ${members.length} memberships`);

    // 2. OPTIMIZED: Batch all queries (was N+1, now 2 queries total!)
    const communityIds = members.map(m => m.community?.id).filter(Boolean);
    console.log(`[PERF] Batching queries for ${communityIds.length} communities`);
    const t3 = Date.now();

    const [memberCounts, allMessages] = await Promise.all([
      prisma.member.groupBy({
        by: ['communityId'],
        where: { communityId: { in: communityIds }, memberStatus: 'active' },
        _count: { id: true }
      }),
      prisma.message.findMany({
        where: { communityId: { in: communityIds } },
        orderBy: { createdAt: 'desc' },
        take: communityIds.length * 2
      })
    ]);
    const t4 = Date.now();
    console.log(`[PERF] Batch queries: ${t4 - t3}ms (counts + messages)`);

    const memberCountMap = Object.fromEntries(memberCounts.map(mc => [mc.communityId, mc._count.id]));
    const lastMessageMap = {};
    for (const msg of allMessages) {
      if (!lastMessageMap[msg.communityId]) lastMessageMap[msg.communityId] = msg;
    }

    const threads = members.map((m) => {
      const c = m.community;
      if (!c) return null;

      const unread = 0;
      const memberCount = memberCountMap[c.id] || 1;
      const lastMsgDoc = lastMessageMap[c.id];

      let lastMsg = { type: 'text', content: 'No messages yet' };
      let lastAt = new Date(c.createdAt).getTime();

      if (lastMsgDoc) {
        lastAt = new Date(lastMsgDoc.createdAt).getTime();
        let type = 'text';
        let content = lastMsgDoc.content;

        // ISSUE #2 FIX: Detect media and show icon instead of URL
        if (lastMsgDoc.attachments && Array.isArray(lastMsgDoc.attachments) && lastMsgDoc.attachments.length > 0) {
          const attachment = lastMsgDoc.attachments[0];
          type = attachment.type || 'photo';
          if (type === 'photo') content = '📷 Photo';
          else if (type === 'video') content = '🎥 Video';
          else if (type === 'file') content = '📎 File';
        } else if (content && content.length > 50) {
          content = content.substring(0, 50) + '...';
        }

        lastMsg = { type, content };
      }

      return {
        id: c.id,
        name: c.name,
        avatar: "🏛️", // Fallback emoji for mobile display
        imageUrl: c.imageUrl || null, // Cloudinary image URL from admin panel
        lastMsg,
        lastAt,
        unread,
        pinned: false, // Not persisted
        memberCount
      };
    });

    const response = { items: threads.filter(Boolean) };

    // 🚀 PERFORMANCE: Cache for 60 seconds
    if (req.redisClient) {
      try {
        await req.redisClient.setex(cacheKey, 60, JSON.stringify(response));
      } catch (cacheErr) {
        console.warn('[CACHE ERROR] Threads write failed:', cacheErr);
      }
    }

    return res.json(response);
  } catch (error) {
    console.error("GET /api/communities/my-threads error:", error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    console.log(`[PERF] my-threads TOTAL: ${Date.now() - startTime}ms`);
  }
});
/**
 * GET /api/communities
 * List communities (optional search + pagination)
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

    const where = {};
    if (qRaw) {
      where.name = { contains: qRaw, mode: 'insensitive' };
    }

    const select = {
      id: true,
      name: true,
      description: true,
      type: true,
      key: true,
      slug: true,
      isPrivate: true,
      tags: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true
    };

    if (wantPaginated) {
      const [items, total] = await prisma.$transaction([
        prisma.community.findMany({
          where,
          select,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.community.count({ where })
      ]);

      const mapped = items.map(c => ({ ...c, _id: c.id })); // Compat

      return res.status(200).json({
        items: mapped,
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      });
    }

    // Non-paginated (legacy behavior?) - limited or all? 
    // Mongoose code without paginated flag did `find(filter)`.
    // It's safer to limit it to avoid dumping 10k communities if database grows.
    // But for now we match behavior or set a reasonable default if not specified? 
    // Mongoose find() returns all. Let's return all but keep memory in mind.
    const items = await prisma.community.findMany({
      where,
      select,
      orderBy: { createdAt: 'desc' }
    });
    const mapped = items.map(c => ({ ...c, _id: c.id }));

    return res.status(200).json(mapped);
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
    const community = await prisma.community.findUnique({
      where: { id: req.params.id }
    });
    if (!community) return res.status(404).json({ error: "Community not found" });

    return res.status(200).json({ ...community, _id: community.id });
  } catch (error) {
    console.error("GET /api/communities/:id error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/communities/:id/unread
 * Stub unread count logic.
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
 */
router.patch("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admins can update communities" });
    }

    const { id } = req.params;

    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) return res.status(404).json({ error: "Community not found" });

    const updates = {};
    const name = req.body.name;
    const desc = req.body.description;

    if (typeof name === "string" && name.trim()) {
      // Duplicate check (exclude self)
      const dup = await prisma.community.findFirst({
        where: {
          id: { not: id },
          name: { equals: name.trim(), mode: 'insensitive' }
        }
      });
      if (dup) return res.status(400).json({ error: "Community name already exists" });
      updates.name = name.trim();
    }

    if (typeof desc === "string") {
      updates.description = desc.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ ...community, _id: community.id });
    }

    const saved = await prisma.community.update({
      where: { id },
      data: updates
    });

    return res.status(200).json({ ...saved, _id: saved.id });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(400).json({ error: "Community name already exists" });
    console.error("PATCH /api/communities/:id error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * DELETE /api/communities/:id
 * Admin-only delete. Also removes Member rows.
 */
router.delete("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admins can delete communities" });
    }

    const { id } = req.params;

    // Transaction to delete members then community
    // Or Prisma Cascade Delete if configured in schema.
    // Checking schema... Member definition:
    // model Member { ... community Community @relation(fields: [communityId], references: [id]) ... }
    // It does not have onDelete: Cascade explicitly set in standard schema usually unless I added it.
    // Defaults to restrictive. I must check schema or delete manually.
    // Mongoose code deleted manually. I'll do manual delete or transaction.

    await prisma.$transaction([
      prisma.member.deleteMany({ where: { communityId: id } }),
      prisma.message.deleteMany({ where: { communityId: id } }), // Optionally delete messages too
      prisma.community.delete({ where: { id } })
    ]);

    return res.status(200).json({ message: "Community deleted" });
  } catch (error) {
    console.error("DELETE /api/communities/:id error:", error);
    if (error?.code === 'P2025') return res.status(404).json({ error: "Community not found" });
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/communities/:id/join
 * Join a community (idempotent).
 */
router.post("/:id/join", async (req, res) => {
  try {
    const personId = req.user?.id;
    const { id } = req.params;

    if (!personId) return res.status(401).json({ error: "Unauthorized" });

    // 🚀 PERFORMANCE: Parallelize community and user fetch
    const [community, user] = await Promise.all([
      prisma.community.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: personId } })
    ]);

    if (!community) return res.status(404).json({ error: "Community not found" });
    if (!user) return res.status(401).json({ error: "User not found" });

    // Check membership
    const exists = await prisma.member.findUnique({
      where: {
        userId_communityId: { userId: personId, communityId: id }
      }
    });

    // Note: If exists but is not 'active' (e.g. banned?), we might need logic.
    // For now, assuming idempotency means "ensure active".
    if (exists && exists.memberStatus === 'active') {
      return res.status(200).json({ message: "Already a member" });
    }

    let membership;

    // Use transaction for upsert
    await prisma.$transaction(async (tx) => {
      membership = await upsertMembership({ tx, user, communityId: community.id });
    });

    // Realtime notifs
    try {
      req.io?.to(String(req.user.id)).emit("membership:joined", {
        userId: String(req.user.id),
        communityId: String(community.id),
      });
      req.presence?.joinCommunity?.(String(req.user.id), String(community.id));
    } catch {
      // ignore socket errors
    }

    // 🚀 PERFORMANCE: Invalidate caches
    await Promise.all([
      invalidateThreadsCache(req, req.user.id),
      invalidateMemberCache(req, community.id)
    ]);

    return res.status(201).json(membership || { message: "Joined" });

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

    if (!personId) return res.status(401).json({ error: "Unauthorized" });

    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) return res.status(404).json({ error: "Community not found" });

    const deleted = await prisma.member.deleteMany({
      where: { userId: personId, communityId: id }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Not a member of this community" });
    }

    // Realtime: notify clients
    try {
      req.io?.to(String(req.user.id)).emit("membership:left", {
        userId: String(req.user.id),
        communityId: String(community.id),
      });
      req.presence?.leaveCommunity?.(String(req.user.id), String(community.id));
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