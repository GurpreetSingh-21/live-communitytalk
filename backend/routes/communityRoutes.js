// backend/routes/communityRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

// All routes require a valid JWT (server also mounts with authenticate)
router.use(authenticate);

/* ───────────────── helpers ───────────────── */

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
    console.error("POST /api/communities error:", error);
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

    const community = await prisma.community.findUnique({ where: { id } });
    const user = await prisma.user.findUnique({ where: { id: personId } });

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