// backend/routes/directMessageRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const DirectMessage = require("../models/DirectMessage");
const Person = require("../person");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

const OID = (id) => new mongoose.Types.ObjectId(String(id));
const isValidId = (id) => mongoose.isValidObjectId(String(id));
const ensureAuthor = (doc, me) => String(doc.from) === String(me);

router.get("/", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const q = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const items = await DirectMessage.aggregate([
      { $match: { $or: [{ from: me }, { to: me }] } },
      { $sort: { createdAt: -1, timestamp: -1, _id: -1 } },
      {
        $addFields: {
          partnerId: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] },
        },
      },
      {
        $group: {
          _id: "$partnerId",
          lastMessage: { $first: "$content" },
          lastAttachments: { $first: "$attachments" },
          lastStatus: { $first: "$status" },
          lastId: { $first: "$_id" },
          lastTimestamp: { $first: { $ifNull: ["$createdAt", "$timestamp"] } },
        },
      },
      {
        $lookup: {
          from: "people",
          localField: "_id",
          foreignField: "_id",
          as: "partner",
        },
      },
      { $unwind: "$partner" },
      ...(q ? [{ $match: { "partner.fullName": { $regex: new RegExp(q, "i") } } }] : []),
      {
        $lookup: {
          from: "directmessages",
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$from", "$$pid"] },
                    { $eq: ["$to", me] },
                    { $in: ["$status", ["sent", "edited"]] },
                  ],
                },
              },
            },
            { $count: "c" },
          ],
          as: "unread",
        },
      },
      {
        $project: {
          partnerId: "$_id",
          fullName: "$partner.fullName",
          avatar: { $ifNull: ["$partner.avatar", "/default-avatar.png"] },
          lastMessage: 1,
          lastAttachments: 1,
          lastStatus: 1,
          lastId: 1,
          lastTimestamp: 1,
          unread: { $ifNull: [{ $arrayElemAt: ["$unread.c", 0] }, 0] },
        },
      },
      { $sort: { lastTimestamp: -1 } },
      { $limit: limit },
    ]);

    const normalized = items.map((t) => ({
      partnerId: String(t.partnerId),
      fullName: t.fullName,
      avatar: t.avatar,
      lastMessage: t.lastMessage,
      hasAttachment: Array.isArray(t.lastAttachments) && t.lastAttachments.length > 0,
      lastStatus: t.lastStatus,
      lastId: String(t.lastId),
      lastTimestamp: t.lastTimestamp,
      unread: t.unread || 0,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error("[DM Routes] LIST error:", err);
    return res.status(500).json({ error: "Failed to fetch conversations", code: "LIST_ERROR" });
  }
});

router.get("/:memberId", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const themRaw = req.params.memberId;
    if (!isValidId(themRaw)) {
      return res.status(400).json({ error: "Invalid memberId", code: "INVALID_MEMBER_ID" });
    }
    const them = OID(themRaw);

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    let before = req.query.before ? new Date(req.query.before) : new Date();
    if (isNaN(before.getTime())) before = new Date();

    const filter = {
      $or: [
        { from: me, to: them },
        { from: them, to: me },
      ],
      $and: [{ $or: [{ createdAt: { $lt: before } }, { timestamp: { $lt: before } }] }],
    };

    const docs = await DirectMessage.find(filter)
      .sort({ createdAt: -1, timestamp: -1, _id: -1 })
      .limit(limit)
      .lean();

    const itemsAsc = docs.reverse();

    return res.json({
      items: itemsAsc,
      nextBefore: itemsAsc.length ? itemsAsc[0].createdAt || itemsAsc[0].timestamp : null,
      hasMore: docs.length === limit,
    });
  } catch (err) {
    console.error("[DM Routes] GET error:", err);
    return res.status(500).json({ error: "Failed to fetch messages", code: "GET_ERROR" });
  }
});

router.post("/", async (req, res) => {
  try {
    const from = OID(req.user.id);
    const { to: toRaw, content = "", attachments = [] } = req.body || {};

    if (!toRaw) {
      return res.status(400).json({ error: "Recipient (to) is required", code: "MISSING_RECIPIENT" });
    }
    if (!isValidId(toRaw)) {
      return res.status(400).json({ error: "Invalid recipient id", code: "INVALID_RECIPIENT_ID" });
    }

    const to = OID(toRaw);
    if (String(to) === String(from)) {
      return res.status(400).json({ error: "Cannot message yourself", code: "SELF_MESSAGE" });
    }

    const recipient = await Person.findById(to).select("_id fullName avatar").lean();
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found", code: "RECIPIENT_NOT_FOUND" });
    }

    const text = String(content || "").trim();
    const hasText = text.length > 0;

    const cleanAttachments = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && a.url)
          .map((a) => ({
            url: String(a.url),
            type: a.type ? String(a.type) : undefined,
            name: a.name ? String(a.name) : undefined,
            size: Number.isFinite(a.size) ? a.size : undefined,
          }))
      : [];

    if (!hasText && cleanAttachments.length === 0) {
      return res.status(400).json({ 
        error: "Message content or attachments required", 
        code: "EMPTY_MESSAGE" 
      });
    }
    if (text.length > 2000) {
      return res.status(400).json({ 
        error: "Message exceeds 2000 characters", 
        code: "MESSAGE_TOO_LONG" 
      });
    }

    const dm = await DirectMessage.create({
      from,
      to,
      content: text,
      attachments: cleanAttachments,
      status: "sent",
    });

    const sender = await Person.findById(from).select("fullName").lean();

    const payload = {
      _id: dm._id,
      from: String(dm.from),
      to: String(dm.to),
      content: dm.content,
      attachments: dm.attachments || [],
      timestamp: dm.createdAt || dm.timestamp,
      senderName: sender?.fullName || "Someone",
      status: dm.status,
    };

    req.io?.to(String(to)).emit("receive_direct_message", payload);
    req.io?.to(String(from)).emit("receive_direct_message", payload);

    return res.status(201).json(payload);
  } catch (err) {
    console.error("[DM Routes] POST error:", err);
    return res.status(500).json({ error: "Failed to send message", code: "SEND_ERROR" });
  }
});

router.patch("/:memberId/read", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const themRaw = req.params.memberId;
    if (!isValidId(themRaw)) {
      return res.status(400).json({ error: "Invalid memberId", code: "INVALID_MEMBER_ID" });
    }
    const them = OID(themRaw);

    const result = await DirectMessage.updateMany(
      { from: them, to: me, status: { $in: ["sent", "edited"] } },
      { $set: { status: "read", readAt: new Date() } }
    );

    req.io?.to(String(them)).emit("dm_read", { by: String(me) });

    return res.json({ updated: result.modifiedCount || 0 });
  } catch (err) {
    console.error("[DM Routes] READ error:", err);
    return res.status(500).json({ error: "Failed to mark as read", code: "READ_ERROR" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const idRaw = req.params.id;
    if (!isValidId(idRaw)) {
      return res.status(400).json({ error: "Invalid message id", code: "INVALID_MESSAGE_ID" });
    }

    const dm = await DirectMessage.findById(idRaw);
    if (!dm) {
      return res.status(404).json({ error: "Message not found", code: "MESSAGE_NOT_FOUND" });
    }

    if (!ensureAuthor(dm, me)) {
      return res.status(403).json({ error: "You can only edit your own messages", code: "NOT_AUTHOR" });
    }
    if (dm.status === "deleted" || dm.isDeleted) {
      return res.status(400).json({ error: "Cannot edit a deleted message", code: "ALREADY_DELETED" });
    }

    const text = String(req.body?.content || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Content is required", code: "MISSING_CONTENT" });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: "Message exceeds 4000 characters", code: "MESSAGE_TOO_LONG" });
    }

    dm.content = text;
    await dm.save();

    const payload = {
      _id: String(dm._id),
      from: String(dm.from),
      to: String(dm.to),
      content: dm.content,
      editedAt: dm.editedAt,
      status: dm.status,
    };

    req.io?.to(String(dm.from)).emit("direct_message:edited", payload);
    req.io?.to(String(dm.to)).emit("direct_message:edited", payload);

    return res.json(payload);
  } catch (err) {
    console.error("[DM Routes] EDIT error:", err);
    return res.status(500).json({ error: "Failed to edit message", code: "EDIT_ERROR" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const idRaw = req.params.id;
    if (!isValidId(idRaw)) {
      return res.status(400).json({ error: "Invalid message id", code: "INVALID_MESSAGE_ID" });
    }

    const dm = await DirectMessage.findById(idRaw);
    if (!dm) {
      return res.status(404).json({ error: "Message not found", code: "MESSAGE_NOT_FOUND" });
    }

    if (!ensureAuthor(dm, me)) {
      return res.status(403).json({ error: "You can only delete your own messages", code: "NOT_AUTHOR" });
    }
    if (dm.status === "deleted" || dm.isDeleted) {
      return res.status(204).end();
    }

    dm.isDeleted = true;
    dm.deletedAt = new Date();
    dm.status = "deleted";
    dm.content = "";
    await dm.save();

    const payload = {
      _id: String(dm._id),
      from: String(dm.from),
      to: String(dm.to),
      status: dm.status,
      deletedAt: dm.deletedAt,
    };

    req.io?.to(String(dm.from)).emit("direct_message:deleted", payload);
    req.io?.to(String(dm.to)).emit("direct_message:deleted", payload);

    return res.status(204).end();
  } catch (err) {
    console.error("[DM Routes] DELETE error:", err);
    return res.status(500).json({ error: "Failed to delete message", code: "DELETE_ERROR" });
  }
});

module.exports = router;