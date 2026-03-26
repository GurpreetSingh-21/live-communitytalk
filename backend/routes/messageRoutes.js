// backend/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { sendPushNotifications } = require("../services/notificationService");

// Require auth
router.use((req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
});

const ROOM = (id) => `community:${id}`;

/* ───────────────────────── Cache Invalidation Helpers ───────────────────────── */
/**
 * 🚀 PERFORMANCE: Invalidate message cache for a community
 */
async function invalidateMessageCache(req, communityId) {
  if (req.redisClient) {
    try {
      const pattern = `messages:${communityId}:*`;
      const keys = await req.redisClient.keys(pattern);
      if (keys.length > 0) {
        await req.redisClient.del(...keys);
        console.log(`[CACHE] Invalidated ${keys.length} message cache entries for ${communityId}`);
      }
    } catch (err) {
      console.warn('[CACHE] Message invalidation failed:', err);
    }
  }
}

/* ───────────────────────── helpers ───────────────────────── */
async function assertCommunityAndMembership(communityId, userId) {
  // 🚀 PERFORMANCE: Run both queries in parallel
  const [comm, membership] = await Promise.all([
    prisma.community.findUnique({ where: { id: communityId } }),
    prisma.member.findUnique({
      where: {
        userId_communityId: { userId: userId, communityId: communityId }
      }
    })
  ]);

  if (!comm) return { ok: false, code: 404, msg: "Community not found" };

  if (!membership || !['active', 'owner'].includes(membership.memberStatus)) {
    return { ok: false, code: 403, msg: "You are not a member of this community" };
  }
  return { ok: true, community: comm };
}

const ensureAuthor = (msg, userId) => msg.senderId === userId;

/* ───────────────────────── POST /api/messages ───────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      content,
      communityId,
      type,
      attachments = [],
      clientMessageId,
      replyTo, // NEW: Accept replyTo from frontend
    } = req.body || {};

    // 1) Validation
    console.log('[MESSAGE POST] Received:', { content: content?.substring(0, 100), communityId });
    if (!content || !communityId) {
      return res
        .status(400)
        .json({ error: "content and communityId are required" });
    }
    if (String(content).length > 4000) {
      return res
        .status(400)
        .json({ error: "Message exceeds 4000 characters" });
    }

    // 2) Membership check
    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    // 3) Attachments
    let parsedAttachments = [];
    if (typeof attachments === 'string' && attachments.trim()) {
      try {
        parsedAttachments = JSON.parse(attachments);
      } catch (e) {
        parsedAttachments = [];
      }
    } else if (Array.isArray(attachments)) {
      parsedAttachments = attachments;
    }

    // 4) Save message
    const msg = await prisma.message.create({
      data: {
        communityId: communityId,
        senderId: req.user.id,
        senderName: req.user.fullName || req.user.email || "Unknown",
        senderAvatar: req.user.avatar || "/default-avatar.png", // 🚀 PERFORMANCE: Capture avatar at send time
        content: String(content),
        attachments: parsedAttachments, // JSONB
        replyToSnapshot: replyTo || undefined, // JSONB, store snapshot
        status: "sent"
      }
    });

    // 4) Payload
    const payload = {
      _id: msg.id, // Compat
      id: msg.id,
      sender: msg.senderName, // Schema: senderName
      senderId: msg.senderId,
      avatar: req.user.avatar || "/default-avatar.png",
      content: msg.content,
      timestamp: msg.createdAt,
      communityId: msg.communityId,
      status: msg.status,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      clientMessageId: clientMessageId || undefined,
      reactions: [],
      replyTo: msg.replyToSnapshot || undefined,
      attachments: msg.attachments, // JSONB
      type: (msg.attachments && msg.attachments.length > 0) ? msg.attachments[0].type : 'text'
    };

    // 5) Real-time emits
    const roomName = ROOM(communityId);
    console.log(`📤 [MESSAGE EMIT] Broadcasting to room: ${roomName}`);
    console.log(`📤 [MESSAGE EMIT] io available: ${!!req.io}`);

    // Debug: Check how many sockets are in the room
    if (req.io) {
      const room = req.io.sockets.adapter.rooms.get(roomName);
      console.log(`📤 [MESSAGE EMIT] Sockets in room ${roomName}: ${room ? room.size : 0}`);
    }

    req.io?.to(roomName).emit("receive_message", payload);
    req.io?.to(roomName).emit("message:new", {
      communityId: String(communityId),
      message: payload,
    });

    if (gate.community && gate.community.key) {
      console.log(`📤 [MESSAGE EMIT] Also emitting to community key: ${gate.community.key}`);
      req.io?.to(gate.community.key).emit("receive_message", payload);
      req.io?.to(gate.community.key).emit("message:new", {
        communityId: String(communityId),
        message: payload,
      });
    }

    // 6) Push notifications (EXPO)
    sendPushNotificationsAsync(communityId, req.user, msg).catch(() => { });

    // 🚀 PERFORMANCE: Invalidate message cache
    await invalidateMessageCache(req, communityId);

    return res.status(201).json(payload);
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * Async helper to send push notifications via Expo
 */
/**
 * Async helper to send push notifications via Expo
 */
async function sendPushNotificationsAsync(communityId, sender, message) {
  try {
    // 🚀 PERFORMANCE: Parallelize member and community queries
    const [members, community] = await Promise.all([
      prisma.member.findMany({
        where: {
          communityId: communityId,
          userId: { not: sender.id },
          memberStatus: { in: ['active', 'owner'] }
        },
        select: { userId: true }
      }),
      prisma.community.findUnique({ 
        where: { id: communityId }, 
        select: { name: true } 
      })
    ]);

    const recipientIds = [...new Set(members.map(m => m.userId))];
    if (recipientIds.length === 0) return;

    // Fetch users with push tokens
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds }},
      select: { id: true, pushTokens: true, fullName: true }
    });

    const validRecipients = recipients.filter(r => r.pushTokens && r.pushTokens.length > 0);
    if (validRecipients.length === 0) return;

    const communityName = community?.name || "Community";
    const senderName = sender.fullName || "Someone";
    const truncatedMessage =
      message.content.length > 80
        ? message.content.slice(0, 80) + "..."
        : message.content;

    const result = await sendPushNotifications(validRecipients, {
      title: `${senderName} in ${communityName}`,
      body: `${sender.fullName || "Someone"}: ${truncatedMessage}`,
      data: {
        type: "new_message",
        communityId: String(communityId),
        messageId: String(message.id),
        senderId: String(sender.id),
        senderName: senderName,
        screen: "CommunityChat",
      },
    });

    if (result?.failureCount > 0) {
      // console.log(`[Notify] Partial success: ${result.successCount} sent, ${result.failureCount} failed.`);
    }
  } catch (notifyErr) {
    console.warn("[Notify] Push failed:", notifyErr.message);
  }
}

/* ─────────────── GET /api/messages/:communityId ─────────────── */
/* ─────────────── GET /api/messages/:communityId ─────────────── */
router.get("/:communityId", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const { communityId } = req.params;

    // 2) Membership check
    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      200
    );
    let before = req.query.before ? new Date(req.query.before) : new Date();
    if (isNaN(before.getTime())) before = new Date();

    // 🚀 PERFORMANCE: Check Redis cache first (30s TTL)
    const cacheKey = `messages:${communityId}:${limit}:${before.getTime()}`;
    if (req.redisClient) {
      try {
        const cached = await req.redisClient.get(cacheKey);
        if (cached) {
          console.log(`[CACHE HIT] Message history for ${communityId}`);
          return res.status(200).json(JSON.parse(cached));
        }
      } catch (cacheErr) {
        console.warn('[CACHE ERROR] Message history read failed:', cacheErr);
      }
    }

    // 🚀 PERFORMANCE: No JOIN for sender - use denormalized senderName field
    // But DO include reactions relation since it's a separate table
    const docs = await prisma.message.findMany({
      where: {
        communityId: communityId,
        createdAt: { lt: before }
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        reactions: {
          include: { user: { select: { fullName: true } } }
        }
      }
    });

    // Map to frontend shape
    const results = docs.map((msg) => ({
      _id: msg.id,
      id: msg.id,
      sender: msg.senderName,  // Use denormalized field
      senderId: msg.senderId,
      avatar: msg.senderAvatar,  // 🚀 PERFORMANCE: Use denormalized avatar (no JOIN!)
      content: msg.content,
      timestamp: msg.createdAt,
      communityId: msg.communityId,
      status: msg.status,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      reactions: (msg.reactions || []).map(r => ({
        emoji: r.emoji,
        userId: r.userId,
        userName: r.user?.fullName || "User",
        createdAt: r.createdAt,
      })),
      replyTo: msg.replyToSnapshot || undefined,
      attachments: msg.attachments,
      type: (msg.attachments && msg.attachments.length > 0) ? msg.attachments[0].type : 'text'
    }));

    // However, for avatar, let's try to get it from relation if possible.
    // Ideally we'd modify the query to include sender.
    // `include: { sender: { select: { avatar: true } } }`
    // Let's do that for better UX.

    const reversedResults = results.reverse();

    // 🚀 PERFORMANCE: Cache results for 30 seconds
    if (req.redisClient) {
      try {
        await req.redisClient.setex(cacheKey, 30, JSON.stringify(reversedResults));
      } catch (cacheErr) {
        console.warn('[CACHE ERROR] Message history write failed:', cacheErr);
      }
    }

    return res.status(200).json(reversedResults);
  } catch (error) {
    console.error("GET /api/messages/:communityId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ─────────────── GET /api/messages/:communityId/latest ─────────────── */
router.get("/:communityId/latest", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { communityId } = req.params;

    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const latest = await prisma.message.findFirst({
      where: { communityId: communityId },
      orderBy: { createdAt: 'desc' },
      include: {
        reactions: {
          include: { user: { select: { fullName: true } } }
        }
      }
    });

    if (!latest) {
      return res.status(200).json(null);
    }

    const result = {
      _id: latest.id,
      id: latest.id,
      sender: latest.senderName,
      senderId: latest.senderId,
      avatar: latest.senderAvatar || "/default-avatar.png",
      content: latest.content,
      timestamp: latest.createdAt,
      communityId: latest.communityId,
      status: latest.status,
      editedAt: latest.editedAt,
      isDeleted: latest.isDeleted,
      deletedAt: latest.deletedAt,
      reactions: (latest.reactions || []).map(r => ({
        emoji: r.emoji,
        userId: r.userId,
        userName: r.user?.fullName || "User",
        createdAt: r.createdAt,
      })),
      replyTo: latest.replyToSnapshot || undefined,
      attachments: latest.attachments
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("GET /api/messages/:communityId/latest error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ───────────────────── PATCH /api/messages/:messageId ───────────────────── */
/* ───────────────────── PATCH /api/messages/:messageId ───────────────────── */
router.patch("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body || {};

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }

    const doc = await prisma.message.findUnique({ where: { id: messageId } });
    if (!doc) return res.status(404).json({ error: "Message not found" });

    if (!ensureAuthor(doc, req.user.id))
      return res.status(403).json({ error: "You can only edit your own message" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        status: "edited",
        editedAt: new Date()
      }
    });

    const payload = {
      _id: updated.id,
      id: updated.id,
      communityId: updated.communityId,
      content: updated.content,
      status: "edited",
      editedAt: updated.editedAt,
    };

    req.io?.to(ROOM(updated.communityId)).emit("message:updated", payload);
    return res.json(payload);
  } catch (error) {
    console.error("PATCH /api/messages/:messageId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ───────────────────── DELETE /api/messages/:messageId ───────────────────── */
router.delete("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    const doc = await prisma.message.findUnique({ where: { id: messageId } });
    if (!doc) return res.status(404).json({ error: "Message not found" });

    if (!ensureAuthor(doc, req.user.id))
      return res.status(403).json({ error: "You can only delete your own message" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: "deleted"
      }
    });

    const payload = {
      _id: updated.id,
      id: updated.id,
      communityId: updated.communityId,
      isDeleted: true,
      deletedAt: updated.deletedAt,
      status: "deleted",
      senderId: updated.senderId,
    };

    req.io?.to(ROOM(updated.communityId)).emit("message:deleted", payload);
    return res.json(payload);
  } catch (error) {
    console.error("DELETE /api/messages/:messageId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ───────────────────── POST /api/messages/:messageId/reactions ───────────────────── */
router.post("/:messageId/reactions", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body || {};

    if (!emoji || typeof emoji !== "string")
      return res.status(400).json({ error: "emoji is required" });

    const doc = await prisma.message.findUnique({ where: { id: messageId } });
    if (!doc) return res.status(404).json({ error: "Message not found" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    // Remove any existing reaction from this user for this emoji, then create new one
    await prisma.reaction.deleteMany({
      where: { messageId, userId: req.user.id, emoji }
    });

    await prisma.reaction.create({
      data: {
        emoji,
        messageId,
        userId: req.user.id,
      }
    });

    // Fetch all reactions for this message to build the payload
    const allReactions = await prisma.reaction.findMany({
      where: { messageId },
      include: { user: { select: { fullName: true } } }
    });

    const reactionsPayload = allReactions.map(r => ({
      emoji: r.emoji,
      userId: r.userId,
      userName: r.user?.fullName || "User",
      createdAt: r.createdAt,
    }));

    const payload = {
      _id: doc.id,
      id: doc.id,
      communityId: doc.communityId,
      reactions: reactionsPayload
    };

    req.io?.to(ROOM(doc.communityId)).emit("message:reacted", payload);
    return res.json(payload);
  } catch (error) {
    console.error("POST /api/messages/:messageId/reactions error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ───────────────────── DELETE /api/messages/:messageId/reactions/:emoji ───────────────────── */
router.delete("/:messageId/reactions/:emoji", async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const decodedEmoji = decodeURIComponent(emoji);

    const doc = await prisma.message.findUnique({ where: { id: messageId } });
    if (!doc) return res.status(404).json({ error: "Message not found" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    // Remove reaction using proper Prisma relational delete
    await prisma.reaction.deleteMany({
      where: { messageId, userId: req.user.id, emoji: decodedEmoji }
    });

    // Fetch remaining reactions for the payload
    const allReactions = await prisma.reaction.findMany({
      where: { messageId },
      include: { user: { select: { fullName: true } } }
    });

    const reactionsPayload = allReactions.map(r => ({
      emoji: r.emoji,
      userId: r.userId,
      userName: r.user?.fullName || "User",
      createdAt: r.createdAt,
    }));

    const payload = {
      _id: doc.id,
      id: doc.id,
      communityId: doc.communityId,
      reactions: reactionsPayload
    };

    req.io?.to(ROOM(doc.communityId)).emit("message:reacted", payload);
    return res.json(payload);
  } catch (error) {
    console.error("DELETE /api/messages/:messageId/reactions/:emoji error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;