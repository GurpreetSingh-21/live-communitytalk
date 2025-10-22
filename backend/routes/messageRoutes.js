// backend/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Message = require("../models/Message");
const Community = require("../models/Community");
const Member = require("../models/Member");

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
      status: { $in: ["active", "owner"] },
    }).lean(),
  ]);

  if (!exists) return { ok: false, code: 404, msg: "Community not found" };
  if (!membership) return { ok: false, code: 403, msg: "You are not a member of this community" };
  return { ok: true };
}

const ensureAuthor = (doc, me) => String(doc.senderId) === String(me);

/* ───────────────────────── POST /api/messages ───────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { content, communityId, attachments = [], clientMessageId } = req.body || {};

    if (!content?.trim() || !communityId) {
      return res.status(400).json({ error: "content and communityId are required" });
    }
    if (!isValidId(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }
    if (String(content).length > 4000) {
      return res.status(400).json({ error: "Message exceeds 4000 characters" });
    }

    const gate = await assertCommunityAndMembership(communityId, req.user.id);
    if (!gate.ok) return res.status(gate.code).json({ error: gate.msg });

    const msg = await Message.create({
      sender: req.user.fullName || "Unknown",
      senderId: req.user.id,
      avatar: req.user.avatar || "/default-avatar.png",
      content: content.trim(),
      timestamp: new Date(),
      communityId: OID(communityId),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const payload = {
      _id: String(msg._id),
      sender: msg.sender,
      senderId: String(msg.senderId),
      avatar: msg.avatar,
      content: msg.content,
      timestamp: msg.timestamp,
      communityId: String(msg.communityId),
      status: msg.status,
      editedAt: msg.editedAt || null,
      isDeleted: !!msg.isDeleted,
      deletedAt: msg.deletedAt || null,
      clientMessageId: clientMessageId || undefined,
    };

    // ✅ realtime emits — support both listeners
    req.io?.to(ROOM(communityId)).emit("receive_message", payload);
    req.io?.to(ROOM(communityId)).emit("message:new", {
      communityId: String(communityId),
      message: payload,
    });

    return res.status(201).json(payload);
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

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

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    let before = req.query.before ? new Date(req.query.before) : new Date();
    if (isNaN(before.getTime())) before = new Date();

    const docs = await Message.find({
      communityId: OID(communityId),
      timestamp: { $lt: before },
    })
      .select("_id sender senderId avatar content timestamp communityId status editedAt isDeleted deletedAt")
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json(docs.reverse());
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

    const latest = await Message.findOne({ communityId: OID(communityId) })
      .select("_id sender senderId avatar content timestamp communityId status editedAt isDeleted deletedAt")
      .sort({ timestamp: -1 })
      .lean();

    return res.status(200).json(latest || null);
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
    if (!isValidId(messageId)) return res.status(400).json({ error: "Invalid messageId" });
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }

    const doc = await Message.findById(messageId);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    if (!ensureAuthor(doc, req.user.id))
      return res.status(403).json({ error: "You can only edit your own message" });

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
    if (!isValidId(messageId)) return res.status(400).json({ error: "Invalid messageId" });

    const doc = await Message.findById(messageId);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    if (!ensureAuthor(doc, req.user.id))
      return res.status(403).json({ error: "You can only delete your own message" });

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