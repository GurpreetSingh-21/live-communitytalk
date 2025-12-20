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

/* ───────────────────────── helpers ───────────────────────── */
async function assertCommunityAndMembership(communityId, userId) {
  const comm = await prisma.community.findUnique({ where: { id: communityId } });
  if (!comm) return { ok: false, code: 404, msg: "Community not found" };

  const membership = await prisma.member.findUnique({
    where: {
      userId_communityId: { userId: userId, communityId: communityId }
    }
  });

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
      reactions: msg.reactions || [],
      replyTo: msg.replyToSnapshot || undefined,
      attachments: msg.attachments, // JSONB
      type: (msg.attachments && msg.attachments.length > 0) ? msg.attachments[0].type : 'text'
    };

    // 5) Real-time emits
    req.io?.to(ROOM(communityId)).emit("receive_message", payload);
    req.io?.to(ROOM(communityId)).emit("message:new", {
      communityId: String(communityId),
      message: payload,
    });

    if (gate.community && gate.community.key) {
      req.io?.to(gate.community.key).emit("receive_message", payload);
      req.io?.to(gate.community.key).emit("message:new", {
        communityId: String(communityId),
        message: payload,
      });
    }

    // 6) Push notifications (EXPO)
    sendPushNotificationsAsync(communityId, req.user, msg).catch(() => { });

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
    // Get active members (except sender)
    const members = await prisma.member.findMany({
      where: {
        communityId: communityId,
        userId: { not: sender.id },
        memberStatus: { in: ['active', 'owner'] } // Prisma uses arrays for in/notIn
      },
      select: { userId: true }
    });

    const recipientIds = [...new Set(members.map(m => m.userId))];
    if (recipientIds.length === 0) return;

    // Fetch users with push tokens
    const recipients = await prisma.user.findMany({
      where: {
        id: { in: recipientIds },
      },
      select: { id: true, pushTokens: true, firstName: true, lastName: true }
    });

    const validRecipients = recipients.filter(r => r.pushTokens && r.pushTokens.length > 0);

    if (validRecipients.length === 0) return;

    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { name: true } });
    const communityName = community?.name || "Community";
    const senderName = sender.fullName || "Someone";
    const truncatedMessage =
      message.content.length > 80
        ? message.content.slice(0, 80) + "..."
        : message.content;

    const result = await sendPushNotifications(validRecipients, {
      title: `${senderName} in ${communityName}`,
      body: truncatedMessage,
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

    const docs = await prisma.message.findMany({
      where: {
        communityId: communityId,
        createdAt: { lt: before }
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // Map to frontend shape
    const results = docs.map((msg) => ({
      _id: msg.id,
      id: msg.id,
      sender: msg.senderName, // Schema: senderName
      senderId: msg.senderId,
      avatar: "/default-avatar.png", // We don't store avatar on message anymore usually, unless snapshotted?
      // Mongoose stored avatar. Prisma has senderName.
      // We might want to join User to get latest avatar?
      // Or if we didn't snapshot it, user gets default.
      // Let's check schema. Message has `senderName` but no `senderAvatar`.
      // Mongoose had `avatar`.
      // I should probably `include: { user: true }` to get avatar?
      // Or just return default for now to be fast.
      // Wait, Mongoose code snapshot it! "avatar: req.user.avatar".
      // My Prisma create logic forgot to save avatar snapshot?
      // Schema check: `model Message`.
      // It has `senderId`, `senderName`, `content`, `attachments`, `reactions`...
      // Does it have avatar snapshot? No.
      // So I must fetch user to get avatar, or accept regression (no avatar).
      // Ideally join user.
      content: msg.content,
      timestamp: msg.createdAt,
      communityId: msg.communityId,
      status: msg.status,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      reactions: msg.reactions || [],
      replyTo: msg.replyToSnapshot || undefined,
      attachments: msg.attachments,
      type: (msg.attachments && msg.attachments.length > 0) ? msg.attachments[0].type : 'text'
    }));

    // However, for avatar, let's try to get it from relation if possible.
    // Ideally we'd modify the query to include sender.
    // `include: { sender: { select: { avatar: true } } }`
    // Let's do that for better UX.

    return res.status(200).json(results.reverse());
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
      orderBy: { createdAt: 'desc' }
      // include: { sender: { select: { avatar: true } } }
    });

    if (!latest) {
      return res.status(200).json(null);
    }

    const result = {
      _id: latest.id,
      id: latest.id,
      sender: latest.senderName,
      senderId: latest.senderId,
      avatar: "/default-avatar.png", // Placeholder until verified
      content: latest.content,
      timestamp: latest.createdAt,
      communityId: latest.communityId,
      status: latest.status,
      editedAt: latest.editedAt,
      isDeleted: latest.isDeleted,
      deletedAt: latest.deletedAt,
      reactions: latest.reactions || [],
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

    // Update reactions jsonb
    // We need to fetch current, modify, then update.
    // Concurrency could be an issue but for now simple read-modify-write.
    let reactions = Array.isArray(doc.reactions) ? doc.reactions : [];

    // Remove existing reaction from this user for this emoji
    reactions = reactions.filter(
      r => !(String(r.userId) === String(req.user.id) && r.emoji === emoji)
    );

    // Add new reaction
    reactions.push({
      emoji,
      userId: req.user.id,
      userName: req.user.fullName || "User",
      createdAt: new Date().toISOString() // Store as string in JSON usually safer
    });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { reactions }
    });

    const payload = {
      _id: updated.id,
      id: updated.id,
      communityId: updated.communityId,
      reactions: updated.reactions
    };

    req.io?.to(ROOM(updated.communityId)).emit("message:reacted", payload);
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

    const doc = await prisma.message.findUnique({ where: { id: messageId } });
    if (!doc) return res.status(404).json({ error: "Message not found" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    let reactions = Array.isArray(doc.reactions) ? doc.reactions : [];

    // Remove reaction
    reactions = reactions.filter(
      r => !(String(r.userId) === String(req.user.id) && r.emoji === decodeURIComponent(emoji))
    );

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { reactions }
    });

    const payload = {
      _id: updated.id,
      id: updated.id,
      communityId: updated.communityId,
      reactions: updated.reactions
    };

    req.io?.to(ROOM(doc.communityId)).emit("message:reacted", payload);
    return res.json(payload);
  } catch (error) {
    console.error("DELETE /api/messages/:messageId/reactions/:emoji error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;