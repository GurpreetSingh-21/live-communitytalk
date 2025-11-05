// backend/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Message = require("../models/Message");
const Community = require("../models/Community");
const Member = require("../models/Member");
const Person = require("../person");
const { sendPushNotifications } = require("../services/notificationService"); // ✅ Use Expo instead of Firebase

// Require auth
router.use((req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
});

const isValidId = (id) => mongoose.isValidObjectId(id);
const OID = (id) => new mongoose.Types.ObjectId(String(id));
const ROOM = (id) => `community:${id}`;

/* ───────────────────────── helpers ───────────────────────── */
async function assertCommunityAndMembership(communityId, personId) {
  const [exists, membership] = await Promise.all([
    Community.exists({ _id: communityId }),
    Member.findOne({
      person: personId,
      community: communityId,
      memberStatus: { $in: ["active", "owner"] },
    }).lean(),
  ]);

  if (!exists) return { ok: false, code: 404, msg: "Community not found" };
  if (!membership)
    return {
      ok: false,
      code: 403,
      msg: "You are not a member of this community",
    };
  return { ok: true };
}

const ensureAuthor = (doc, me) => String(doc.senderId) === String(me);

/* ───────────────────────── POST /api/messages ───────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      content,
      communityId,
      attachments = [],
      clientMessageId,
    } = req.body || {};

    // 1) Validation
    if (!content?.trim() || !communityId) {
      return res
        .status(400)
        .json({ error: "content and communityId are required" });
    }
    if (!isValidId(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }
    if (String(content).length > 4000) {
      return res
        .status(400)
        .json({ error: "Message exceeds 4000 characters" });
    }

    // 2) Membership check
    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    // 3) Save message
    // ✅ FIX: Removed redundant 'timestamp' field. 'createdAt' is added automatically.
    const msg = await Message.create({
      sender: req.user.fullName || "Unknown",
      senderId: req.user.id,
      avatar: req.user.avatar || "/default-avatar.png",
      content: content.trim(),
      communityId: OID(communityId),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // 4) Payload
    // ✅ FIX: Use 'msg.createdAt' for the 'timestamp' field.
    const payload = {
      _id: String(msg._id),
      sender: msg.sender,
      senderId: String(msg.senderId),
      avatar: msg.avatar,
      content: msg.content,
      timestamp: msg.createdAt, // <-- FIX
      communityId: String(msg.communityId),
      status: msg.status,
      editedAt: msg.editedAt || null,
      isDeleted: !!msg.isDeleted,
      deletedAt: msg.deletedAt || null,
      clientMessageId: clientMessageId || undefined,
    };

    // 5) Real-time emits
    req.io?.to(ROOM(communityId)).emit("receive_message", payload);
    req.io?.to(ROOM(communityId)).emit("message:new", {
      communityId: String(communityId),
      message: payload,
    });

    // 6) Push notifications (EXPO) - ✅ UPDATED TO USE EXPO
    sendPushNotificationsAsync(communityId, req.user, msg);

    // 7) Done
    return res.status(201).json(payload);
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/**
 * ✅ NEW: Async helper to send push notifications via Expo
 * This runs in the background and doesn't block the response
 */
async function sendPushNotificationsAsync(communityId, sender, message) {
  try {
    // Find all active members of the community (except the sender)
    const members = await Member.find({
      community: OID(communityId),
      person: { $ne: OID(sender.id) }, // Don't send to self
      memberStatus: { $in: ["active", "owner"] },
    })
      .select("person")
      .lean();

    // Get the unique Person IDs
    const recipientIds = [
      ...new Set(members.map((m) => m.person).filter(Boolean)),
    ];

    if (recipientIds.length === 0) {
      console.log(`[Notify] No members to notify in community ${communityId}`);
      return;
    }

    // Get all users with push tokens
    const recipients = await Person.find({
      _id: { $in: recipientIds },
      pushTokens: { $exists: true, $ne: [] },
    })
      .select("pushTokens firstName lastName")
      .lean();

    if (recipients.length === 0) {
      console.log(`[Notify] No recipients with push tokens in community ${communityId}`);
      return;
    }

    console.log(
      `[Notify] Sending push to ${recipients.length} users in community ${communityId}`
    );

    // Get community name for notification
    const community = await Community.findById(communityId).select("name").lean();
    const communityName = community?.name || "Community";

    // Prepare notification content
    const senderName = sender.fullName || "Someone";
    const truncatedMessage =
      message.content.length > 80
        ? message.content.slice(0, 80) + "..."
        : message.content;

    // Use the Expo notification service
    const result = await sendPushNotifications(recipients, {
      title: `${senderName} in ${communityName}`,
      body: truncatedMessage,
      data: {
        type: "new_message",
        communityId: String(communityId),
        messageId: String(message._id),
        senderId: String(sender.id),
        senderName: senderName,
        screen: "CommunityChat",
      },
    });

    console.log(
      `[Notify] Results - Success: ${result.successCount}, Failure: ${result.failureCount}`
    );
  } catch (notifyErr) {
    console.error("⚠️ Push notification failed:", notifyErr?.message || notifyErr);
  }
}

/* ─────────────── GET /api/messages/:communityId ─────────────── */
router.get("/:communityId", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const { communityId } = req.params;
    if (!isValidId(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }

    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "500r", 10), 1),
      200
    );
    let before = req.query.before ? new Date(req.query.before) : new Date();
    if (isNaN(before.getTime())) before = new Date();

    // ✅ FIX: Query using 'createdAt' instead of 'timestamp'
    const docs = await Message.find({
      communityId: OID(communityId),
      createdAt: { $lt: before }, // <-- FIX
    })
      .select(
        // ✅ FIX: Select 'createdAt' instead of 'timestamp'
        "_id sender senderId avatar content createdAt communityId status editedAt isDeleted deletedAt" // <-- FIX
      )
      .sort({ createdAt: -1 }) // <-- FIX
      .limit(limit)
      .lean();

    // ✅ FIX: Map results to rename 'createdAt' to 'timestamp' for the frontend
    const results = docs.reverse().map((d) => {
      const { createdAt, ...rest } = d;
      return { ...rest, timestamp: createdAt };
    });

    return res.status(200).json(results);
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
    if (!isValidId(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }

    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    // ✅ FIX: Sort by 'createdAt'
    const latest = await Message.findOne({ communityId: OID(communityId) })
      .select(
        // ✅ FIX: Select 'createdAt'
        "_id sender senderId avatar content createdAt communityId status editedAt isDeleted deletedAt" // <-- FIX
      )
      .sort({ createdAt: -1 }) // <-- FIX
      .lean();

    // ✅ FIX: Rename 'createdAt' to 'timestamp' for the frontend
    if (!latest) {
      return res.status(200).json(null);
    }
    const { createdAt, ...rest } = latest;
    const result = { ...rest, timestamp: createdAt };

    return res.status(200).json(result);
  } catch (error) {
    console.error("GET /api/messages/:communityId/latest error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

/* ───────────────────── PATCH /api/messages/:messageId ───────────────────── */
router.patch("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body || {};
    if (!isValidId(messageId))
      return res.status(400).json({ error: "Invalid messageId" });
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }

    const doc = await Message.findById(messageId);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    if (!ensureAuthor(doc, req.user.id))
      return res
        .status(403)
        .json({ error: "You can only edit your own message" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    doc.content = content.trim();
    await doc.save();

    const payload = {
      _id: String(doc._id),
      communityId: String(doc.communityId),
      content: doc.content,
      status: "edited",
      editedAt: doc.editedAt || new Date(),
    };

    req.io?.to(ROOM(doc.communityId)).emit("message:updated", payload);
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
    if (!isValidId(messageId))
      return res.status(400).json({ error: "Invalid messageId" });

    const doc = await Message.findById(messageId);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    if (!ensureAuthor(doc, req.user.id))
      return res
        .status(403)
        .json({ error: "You can only delete your own message" });

    const gate = await assertCommunityAndMembership(doc.communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    await doc.markDeleted();

    const payload = {
      _id: String(doc._id),
      communityId: String(doc.communityId),
      isDeleted: true,
      deletedAt: doc.deletedAt || new Date(),
      status: "deleted",
      senderId: String(doc.senderId),
    };

    req.io?.to(ROOM(doc.communityId)).emit("message:deleted", payload);
    return res.json(payload);
  } catch (error) {
    console.error("DELETE /api/messages/:messageId error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;