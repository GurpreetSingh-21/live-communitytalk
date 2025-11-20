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
      
      // 4. ⭐ FIX: Convert Partner ID to ObjectId safely
      // This fixes the "Deleted User" bug caused by String vs ObjectId mismatch
      { $addFields: { 
          partnerIdObj: { $toObjectId: "$partnerIdRaw" } 
      }},

      // 5. Group by the standardized ObjectId
      {
        $group: {
          _id: "$partnerIdObj",
          partnerIdRaw: { $first: "$partnerIdRaw" }, // Keep raw ID for reference
          lastMessage: { $first: "$content" },
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
          localField: "_id", // Now matching ObjectId to ObjectId
          foreignField: "_id",
          as: "partner",
        },
      },
      
      // 7. Unwind safely (keep chat even if user missing)
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
          let: { pid: "$partnerIdRaw" }, // Use raw ID to match message document format
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
      
      // 10. ⭐ FIX: Smart Project for Name & Avatar
      {
        $project: {
          partnerId: "$_id",
          
          // Try 'fullName', then 'name', then combine 'firstName + lastName'
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
          
          // Check all possible avatar fields
          avatar: { $ifNull: ["$partner.avatar", "$partner.photoUrl", "$partner.image", "/default-avatar.png"] },
          
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
      email: t.email,
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

    // Match messages regardless of which ID type (String/ObjectId) was saved
    const filter = {
      $or: [
        { from: me, to: them },
        { from: them, to: me },
        // Fallback for string-saved IDs if any exist
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

    // 1. Check if they ever replied (ObjectId check)
    const hasReplied = await DirectMessage.exists({ from: to, to: from });

    if (!hasReplied) {
      const mySentCount = await DirectMessage.countDocuments({ from: from, to: to });
      // Anti-spam: Block if 1 message sent with no reply
      if (mySentCount >= 1) {
        return res.status(403).json({ 
          error: "You cannot send another message until the user replies." 
        });
      }
    }

    const dm = await DirectMessage.create({
      from, // Saved as ObjectId
      to,   // Saved as ObjectId
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
    
    // Update matches both ObjectId and String formats to be safe
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