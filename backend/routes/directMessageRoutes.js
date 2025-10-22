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

// ───────────────────────── GET threads (inbox) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const q = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const items = await DirectMessage.aggregate([
      { $match: { $or: [{ from: me }, { to: me }] } },
      { $sort: { createdAt: -1 } },
      { $addFields: { partnerId: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] } } },
      {
        $group: {
          _id: "$partnerId",
          lastMessage: { $first: "$content" },
          lastAttachments: { $first: "$attachments" },
          lastStatus: { $first: "$status" },
          lastId: { $first: "$_id" },
          lastTimestamp: { $first: "$createdAt" },
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
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// ───────────────────────── GET messages with user ─────────────────────────
router.get("/:memberId", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const themRaw = req.params.memberId;
    if (!isValidId(themRaw)) return res.status(400).json({ error: "Invalid memberId" });
    const them = OID(themRaw);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const filter = {
      $or: [
        { from: me, to: them },
        { from: them, to: me },
      ],
    };

    const docs = await DirectMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ items: docs.reverse() });
  } catch (err) {
    console.error("[DM Routes] GET error:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ───────────────────────── POST new DM ─────────────────────────
router.post("/", async (req, res) => {
  try {
    const from = OID(req.user.id);
    const { to: toRaw, content = "", attachments = [] } = req.body || {};
    if (!isValidId(toRaw)) return res.status(400).json({ error: "Invalid recipient id" });
    const to = OID(toRaw);
    if (String(to) === String(from))
      return res.status(400).json({ error: "Cannot message yourself" });

    const text = String(content || "").trim();
    const cleanAttachments = Array.isArray(attachments)
      ? attachments.filter((a) => a && a.url)
      : [];

    if (!text && cleanAttachments.length === 0)
      return res.status(400).json({ error: "Message content or attachments required" });

    const dm = await DirectMessage.create({
      from,
      to,
      content: text,
      attachments: cleanAttachments,
      status: "sent",
    });

    const payload = {
      _id: dm._id,
      from: String(dm.from),
      to: String(dm.to),
      content: dm.content,
      attachments: dm.attachments,
      timestamp: dm.createdAt,
      status: dm.status,
    };

    // ✅ emit both events for universal support
    req.io?.to(String(to)).emit("receive_direct_message", payload);
    req.io?.to(String(to)).emit("dm:message", payload);
    req.io?.to(String(from)).emit("dm:message", payload);

    return res.status(201).json(payload);
  } catch (err) {
    console.error("[DM Routes] POST error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// ───────────────────────── PATCH mark as read ─────────────────────────
router.patch("/:memberId/read", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const them = OID(req.params.memberId);
    const result = await DirectMessage.updateMany(
      { from: them, to: me, status: { $in: ["sent", "edited"] } },
      { $set: { status: "read", readAt: new Date() } }
    );
    req.io?.to(String(them)).emit("dm_read", { by: String(me) });
    return res.json({ updated: result.modifiedCount || 0 });
  } catch (err) {
    console.error("[DM Routes] READ error:", err);
    return res.status(500).json({ error: "Failed to mark as read" });
  }
});

module.exports = router;