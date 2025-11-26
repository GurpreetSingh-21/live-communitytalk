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

// ───────────────────────── GET threads (inbox) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const q = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const items = await DirectMessage.aggregate([
      // 1. Match messages for 'me'
      { $match: { $or: [{ from: me }, { to: me }] } },
      
      // 2. Sort by newest first
      { $sort: { createdAt: -1 } },
      
      // 3. Identify Partner ID (Raw)
      { $addFields: { partnerIdRaw: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] } } },
      
      // 4. Convert Partner ID to ObjectId safely
      { $addFields: { 
          partnerIdObj: { $toObjectId: "$partnerIdRaw" } 
      }},

      // 5. Group by the standardized ObjectId
      {
        $group: {
          _id: "$partnerIdObj",
          partnerIdRaw: { $first: "$partnerIdRaw" },
          lastMessage: { $first: "$content" },
          lastType: { $first: "$type" }, // ✅ Capture type for preview
          lastAttachments: { $first: "$attachments" },
          lastStatus: { $first: "$status" },
          lastId: { $first: "$_id" },
          lastTimestamp: { $first: "$createdAt" },
        },
      },
      
      // 6. Lookup Partner details
      {
        $lookup: {
          from: "people",
          localField: "_id",
          foreignField: "_id",
          as: "partner",
        },
      },
      
      // 7. Unwind safely
      { 
        $unwind: {
          path: "$partner",
          preserveNullAndEmptyArrays: true 
        } 
      },

      // 8. Search Filter
      ...(q ? [{ $match: { 
          $or: [
             { "partner.fullName": { $regex: new RegExp(q, "i") } },
             { "partner.firstName": { $regex: new RegExp(q, "i") } },
             { "partner.lastName": { $regex: new RegExp(q, "i") } }
          ]
      } }] : []),
      
      // 9. Count Unread
      {
        $lookup: {
          from: "directmessages",
          let: { pid: "$partnerIdRaw" },
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
      
      // 10. Smart Project for Name & Avatar
      {
        $project: {
          partnerId: "$_id",
          fullName: { 
            $ifNull: [
              "$partner.fullName", 
              "$partner.name", 
              { 
                $trim: { 
                  input: { $concat: [{ $ifNull: ["$partner.firstName", ""] }, " ", { $ifNull: ["$partner.lastName", ""] }] } 
                } 
              }, 
              "Unknown User"
            ] 
          },
          email: { $ifNull: ["$partner.email", ""] },
          avatar: { $ifNull: ["$partner.avatar", "$partner.photoUrl", "$partner.image", "/default-avatar.png"] },
          lastMessage: 1,
          lastType: 1,
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

    // Generate human-readable previews based on message type
    const normalized = items.map((t) => {
      let preview = t.lastMessage;
      if (!preview || preview.trim() === "") {
        if (t.lastType === 'photo') preview = '[Photo]';
        else if (t.lastType === 'video') preview = '[Video]';
        else if (t.lastType === 'audio') preview = '[Voice Note]';
        else if (t.lastType === 'file') preview = '[File]';
      }

      return {
        partnerId: String(t.partnerId),
        fullName: t.fullName,
        email: t.email,
        avatar: t.avatar,
        lastMessage: preview,
        hasAttachment: Array.isArray(t.lastAttachments) && t.lastAttachments.length > 0,
        lastStatus: t.lastStatus,
        lastId: String(t.lastId),
        lastTimestamp: t.lastTimestamp,
        unread: t.unread || 0,
      };
    });

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
        { from: String(me), to: String(them) },
        { from: String(them), to: String(me) },
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

// ───────────────────────── Unified Send Handler ─────────────────────────
const handleSend = async (req, res) => {
  try {
    const from = OID(req.user.id);
    // Allow 'to' ID to come from URL params OR Body
    const toRaw = req.params.id || req.body.to;
    
    if (!isValidId(toRaw)) return res.status(400).json({ error: "Invalid recipient id" });
    const to = OID(toRaw);
    
    if (String(to) === String(from))
      return res.status(400).json({ error: "Cannot message yourself" });

    let { content = "", attachments = [], type = "text", clientMessageId } = req.body;

    // ✅ FIX: Safe parsing if attachments arrive as a JSON string
    if (typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch (e) {
        console.warn("[DM Routes] Failed to parse attachments string, defaulting to empty array");
        attachments = [];
      }
    }

    const text = String(content || "").trim();
    const cleanAttachments = Array.isArray(attachments) ? attachments : [];

    if (!text && cleanAttachments.length === 0)
      return res.status(400).json({ error: "Message content or attachments required" });

    // Anti-spam check: Check if they ever replied
    const hasReplied = await DirectMessage.exists({ from: to, to: from });
    if (!hasReplied) {
      const mySentCount = await DirectMessage.countDocuments({ from: from, to: to });
      // Allow up to 5 initial messages before blocking
      if (mySentCount >= 5) {
        return res.status(403).json({ 
          error: "You cannot send more messages until the user replies." 
        });
      }
    }

    const dm = await DirectMessage.create({
      from,
      to,
      content: text,
      attachments: cleanAttachments, // ✅ Now guaranteed to be an array or object, not string
      status: "sent",
      type: type, // ✅ Save message type
    });

    const payload = {
      _id: dm._id,
      from: String(dm.from),
      to: String(dm.to),
      content: dm.content,
      attachments: dm.attachments,
      timestamp: dm.createdAt,
      status: dm.status,
      type: dm.type,
      clientMessageId
    };

    req.io?.to(String(to)).emit("receive_direct_message", payload);
    req.io?.to(String(to)).emit("dm:message", payload);
    req.io?.to(String(from)).emit("dm:message", payload);

    return res.status(201).json(payload);
  } catch (err) {
    console.error("[DM Routes] POST error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

// Register the same handler for both route patterns
router.post("/", handleSend);
router.post("/:id", handleSend);

// ───────────────────────── PATCH mark as read ─────────────────────────
router.patch("/:memberId/read", async (req, res) => {
  try {
    const me = OID(req.user.id);
    const them = OID(req.params.memberId);
    
    const result = await DirectMessage.updateMany(
      { 
        $or: [
            { from: them, to: me },
            { from: String(them), to: String(me) }
        ],
        status: { $in: ["sent", "edited"] } 
      },
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