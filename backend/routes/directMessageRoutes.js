// backend/routes/directMessageRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);


// ───────────────────────── GET threads (inbox) ─────────────────────────
// ───────────────────────── GET threads (inbox) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    const me = req.user.id;
    const q = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    // 1. Get raw conversation heads (DISTINCT ON partner)
    // We want the LATEST message for each interaction.
    // Partner ID is usually the OTHER person.

    // Postgres specific raw query for performance
    // Note: Table name is "directmessages" (lowercase) due to @@map("directmessages")?
    // Let's verify Mongoose model name vs Prisma. Prisma @@map("directmessages")? No, wait.
    // user report routes used @@map("reports")?
    // I need to check schema map.
    // DirectMessage model in previous view didn't show @@map.
    // Default table name is `DirectMessage`.
    // Wait, Mongoose used `directmessages`.
    // I should double check actual table name in DB.
    // Assuming standard Prisma naming if not mapped: `DirectMessage` (PascalCase) or `direct_messages` (snake)?
    // Prisma default is usually Model Name unless mapped.
    // Safest is to rely on Prisma Client API where possible, or check map.
    // Re-checking schema view...
    // Lines 231-250 don't show @@map.
    // If no map, table is "DirectMessage".
    // I will try to use pure Prisma `findMany` strategy first to avoid Raw SQL table name guessing, 
    // OR just use `prisma.$queryRaw` with inferred name if I'm sure.
    // Strategy B: Fetch all "contacts" first?
    // If I use `distinct: ['fromId', 'toId']` it gives me unique pairs.
    // E.g. (A, B) and (B, A) are distinct.
    // I want to unify (A,B) and (B,A) into Key={A,B sorted}.
    // This is hard in pure Prisma without fetching all.
    // Raw SQL is best.
    // Table name guessing: I'll assume "DirectMessage" for now, but usually it's case sensitive in Postgres if quoted.
    // Let's check `User` model map: `@@map("users")`.
    // `DirectMessage` likely needs a map if we want clean names, but if not set, it's `DirectMessage`.

    // Fallback: If map is missing, I'll stick to Prisma JS logic for safety, optimizing if needed later.
    // JS Logic: Fetch all headers (ID, from, to, createdAt).
    // Sort by createdAt DESC.
    // Iterate and pick first occurrence of each partner.
    // Stop after `limit` partners found (with some buffer).

    const currentUserId = req.user?._id || req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 🚀 PERFORMANCE: Check Redis cache first
    const cacheKey = `dm_inbox:${currentUserId}`;
    try {
      const cached = await req.redisClient.get(cacheKey);
      if (cached) {
        console.log(`[DM Inbox] 💾 Cache HIT for user ${currentUserId.substring(0, 8)}`);
        return res.json(JSON.parse(cached));
      }
      console.log(`[DM Inbox] 💾 Cache MISS for user ${currentUserId.substring(0, 8)}`);
    } catch (cacheErr) {
      console.warn('[DM Inbox] Cache read failed:', cacheErr);
    }

    const context = (req.query.context || "community").trim();

    // 🚀 PERFORMANCE: Fetch last 100 messages (was 1000!) with only needed fields
    const recentMessages = await prisma.directMessage.findMany({
      where: {
        AND: [
          { OR: [{ fromId: me }, { toId: me }] },
          { context: context }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100,  // ✅ Reduced from 1000
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        status: true,
        fromId: true,
        toId: true,
        isEncrypted: true,
        // Don't fetch attachments array unless needed for preview
      }
    });

    const conversations = new Map();
    const headers = [];

    for (const msg of recentMessages) {
      const partnerId = msg.fromId === me ? msg.toId : msg.fromId;
      if (!conversations.has(partnerId)) {
        conversations.set(partnerId, true);

        // Generate preview
        let preview = msg.content;
        if (!preview || !preview.trim()) {
          if (msg.type === 'photo') preview = '[Photo]';
          else if (msg.type === 'video') preview = '[Video]';
          else if (msg.type === 'audio') preview = '[Voice Note]';
          else if (msg.type === 'file') preview = '[File]';
        }

        headers.push({
          partnerId,
          lastMessage: preview,
          lastType: msg.type,
          lastAttachments: msg.attachments,
          lastStatus: msg.status,
          lastId: msg.id,
          lastTimestamp: msg.createdAt,
          isEncrypted: msg.isEncrypted || false, // E2EE flag for preview
          // unread stub, filled later
          unread: 0
        });
      }
      if (headers.length >= limit) break;
    }

    // 🚀 PERFORMANCE: Fetch users and unread counts in parallel
    const partnerIds = headers.map(h => h.partnerId);
    
    const [users, unreadCounts] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, fullName: true, email: true, avatar: true }
      }),
      prisma.directMessage.groupBy({
        by: ['fromId'],
        where: {
          toId: me,
          fromId: { in: partnerIds },
          status: { in: ['sent', 'edited'] }
        },
        _count: true
      })
    ]);
    
    const userMap = new Map(users.map(u => [u.id, u]));
    const unreadMap = new Map(unreadCounts.map(u => [u.fromId, u._count]));

    // Map headers to normalized conversations
    let normalized = headers.map(h => {
      const u = userMap.get(h.partnerId);
      return {
        ...h,
        fullName: u?.fullName || u?.email || "Unknown User",
        firstName: u?.firstName,
        lastName: u?.lastName,
        email: u?.email || "",
        avatar: u?.avatar || "/default-avatar.png",
        hasAttachment: Array.isArray(h.lastAttachments) && h.lastAttachments.length > 0
      };
    });

    // Filter by search query if present
    if (q) {
      const rx = new RegExp(q, "i");
      normalized = normalized.filter(h =>
        rx.test(h.fullName) || rx.test(h.email)
      );
    }

    // Add unread counts

    normalized = normalized.map(h => ({
      ...h,
      unread: unreadMap.get(h.partnerId) || 0
    }));

    // 🚀 PERFORMANCE: Save to Redis cache (30 second TTL)
    try {
      await req.redisClient.setex(cacheKey, 30, JSON.stringify(normalized));
      console.log(`[DM Inbox] 💾 Cached ${normalized.length} conversations for 30s`);
    } catch (cacheErr) {
      console.warn('[DM Inbox] Cache save failed:', cacheErr);
    }

    return res.json(normalized);
  } catch (err) {
    console.error("[DM Routes] LIST error:", err);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// ───────────────────────── GET messages with user ─────────────────────────
// ───────────────────────── GET messages with user ─────────────────────────
router.get("/:memberId", async (req, res) => {
  try {
    const me = req.user.id;
    const them = req.params.memberId;

    // Check if 'them' is valid ID? Usually CUID in Prisma/Postgres, not OID.
    // If we assume valid string.

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const context = (req.query.context || "community").trim();

    // 🚀 Try Redis cache first (2 min TTL)
    const cacheKey = `dm:messages:${me}:${them}:${context}:${limit}`;
    if (req.redisClient) {
      const cached = await req.redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ [Cache HIT] DM messages ${me.slice(0,8)}-${them.slice(0,8)}`);
        return res.json(JSON.parse(cached));
      }
    }

    const docs = await prisma.directMessage.findMany({
      where: {
        AND: [
          {
            OR: [
              { fromId: me, toId: them },
              { fromId: them, toId: me }
            ]
          },
          { context: context }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Convert to frontend format with both Prisma and legacy field names
    const normalized = docs.reverse().map(m => ({
      // Prisma fields
      id: m.id,
      fromId: m.fromId,
      toId: m.toId,
      content: m.content,
      createdAt: m.createdAt,
      type: m.type || 'text',
      status: m.status,
      attachments: m.attachments,
      isEncrypted: m.isEncrypted || false,  // E2EE flag
      // Legacy MongoDB field names for frontend compatibility
      _id: m.id,
      from: m.fromId,
      to: m.toId,
      timestamp: m.createdAt,
    }));

    const response = { items: normalized };

    // 💾 Cache for 2 minutes
    if (req.redisClient) {
      await req.redisClient.setex(cacheKey, 120, JSON.stringify(response));
      console.log(`💾 [Cache MISS] Cached DM messages ${me.slice(0,8)}-${them.slice(0,8)}`);
    }

    return res.json(response);
  } catch (err) {
    console.error("[DM Routes] GET error:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ───────────────────────── Unified Send Handler ─────────────────────────
const handleSend = async (req, res) => {
  try {
    const from = req.user.id;
    const to = req.params.id || req.body.to;

    // 🛡️ SAFETY: Rate Limit
    // Use a shared rate limiter import
    const RateLimiter = require('../services/RateLimiter');
    const ALLOWED_RATE = RateLimiter.checkLimit(from, 'send_dm', 15, 60 * 1000); // 15 per min
    if (!ALLOWED_RATE) {
      return res.status(429).json({ error: "You are sending messages too fast. Please slow down." });
    }

    // 🛡️ SAFETY: Spam Repetition
    const ALLOWED_CONTENT = RateLimiter.checkRepetition(from, req.body.content || "", 3);
    if (!ALLOWED_CONTENT) {
      return res.status(429).json({ error: "Please avoid repeating the same message." });
    }

    if (!to) return res.status(400).json({ error: "Invalid recipient id" });
    if (String(to) === String(from))
      return res.status(400).json({ error: "Cannot message yourself" });

    let { content = "", attachments = [], type = "text", clientMessageId, isEncrypted = false } = req.body;

    // Attachments check
    if (typeof attachments === 'string') {
      try { attachments = JSON.parse(attachments); } catch (e) { attachments = []; }
    }
    const cleanAttachments = Array.isArray(attachments) ? attachments : [];
    const text = String(content || "").trim();

    if (!text && cleanAttachments.length === 0)
      return res.status(400).json({ error: "Message content or attachments required" });

    // 🚀 PERFORMANCE: Parallelize anti-spam checks
    const [hasReplied, mySentCount] = await Promise.all([
      prisma.directMessage.findFirst({
        where: { fromId: to, toId: from }
      }),
      prisma.directMessage.count({
        where: { fromId: from, toId: to }
      })
    ]);

    if (!hasReplied && mySentCount >= 5) {
      return res.status(403).json({
        error: "You cannot send more messages until the user replies."
      });
    }

    const dm = await prisma.directMessage.create({
      data: {
        fromId: from,
        toId: to,
        content: text,
        attachments: cleanAttachments, // JSONB
        status: "sent",
        type: type,
        context: req.body.context || "community",
        isEncrypted: !!isEncrypted  // E2EE flag
      }
    });

    const payload = {
      _id: dm.id,
      id: dm.id,
      from: dm.fromId,
      to: dm.toId,
      content: dm.content,
      attachments: dm.attachments,
      timestamp: dm.createdAt,
      status: dm.status,
      type: dm.type,
      isEncrypted: dm.isEncrypted,  // E2EE flag
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
// ───────────────────────── PATCH mark as read ─────────────────────────
router.patch("/:memberId/read", async (req, res) => {
  try {
    const me = req.user.id;
    const them = req.params.memberId;

    // Update all sent/edited messages from "them" to "me"
    const result = await prisma.directMessage.updateMany({
      where: {
        fromId: them,
        toId: me,
        status: { in: ["sent", "edited"] }
      },
      data: {
        status: "read",
        readAt: new Date()
      }
    });

    req.io?.to(String(them)).emit("dm_read", { by: String(me) });
    return res.json({ updated: result.count || 0 });
  } catch (err) {
    console.error("[DM Routes] READ error:", err);
    return res.status(500).json({ error: "Failed to mark as read" });
  }
});

module.exports = router;