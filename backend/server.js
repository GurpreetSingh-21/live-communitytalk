// backend/server.js

// 🌐 Core Modules
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Expo } = require("expo-server-sdk");

// 🔒 SECURITY FIX (Flaw 3): Import DOMPurify for XSS protection
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// 🔌 Redis & Socket.io Adapter
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");

// 🔌 Database
// 🔌 Database (Prisma)
const prisma = require("./prisma/client");

// 👥 Presence Tracker (Redis-backed)
const presence = require("./presence");

// 🧰 Routes & Middleware
const authenticate = require("./middleware/authenticate");
const personRoutes = require("./routes/loginNregRoutes");
const communityRoutes = require("./routes/communityRoutes");
const memberRoutes = require("./routes/memberRoutes");
const messageRoutes = require("./routes/messageRoutes");
const directMessageRoutes = require("./routes/directMessageRoutes");
const adminRoutes = require("./routes/adminRoutes");
const publicRoutes = require("./routes/publicRoutes");
const eventRoutes = require("./routes/events");
const registerEventSockets = require("./sockets/events");
const notificationRoutes = require("./routes/notificationRoutes");
const datingRoutes = require("./routes/datingRoutes"); // Dating feature
const userRoutes = require("./routes/userRoutes"); // ✅ User routes (avatar upload)
const userReportRoutes = require("./routes/userReportRoutes");
const uploadRoutes = require('./routes/upload');
const reactionRoutes = require('./routes/reactionRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const safetyRoutes = require('./routes/safetyRoutes'); // Safety & Moderation

// 📦 Models
// const Person = require("./person");
// const Member = require("./models/Member");
// const Message = require("./models/Message");

// ⚙️ App + Server
const app = express();
const server = http.createServer(app);

// ───────────────────────── Configuration ─────────────────────────
const ORIGIN_ENV =
  process.env.CLIENT_ORIGIN ||
  [
    "http://localhost:5173",
    "http://localhost:3001",
  ].join(",");

const ORIGIN = ORIGIN_ENV.split(",").map((o) => o.trim());
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.MY_SECRET_KEY;

// 🔥 CRITICAL SECURITY FIX: Fail fast if JWT secret is missing
if (!JWT_SECRET) {
  console.error("❌ FATAL ERROR: Missing MY_SECRET_KEY environment variable. Cannot start server.");
  process.exit(1);
}

// Redis Configuration
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
if (!process.env.REDIS_URL) {
  console.warn(
    "⚠️ Missing REDIS_URL. Using fallback. This is required for scaling."
  );
}
const redisOptions = {};

// ───────────────────────── Redis & Presence Init ─────────────────────────
// Client for presence
const redisClient = new Redis(REDIS_URL, redisOptions);

redisClient.on("connect", () =>
  console.log("✅ Redis connected for Presence.")
);
redisClient.on("error", (err) =>
  console.error("❌ Redis Presence error:", err)
);

// Pass the client to our presence module
presence.init(redisClient);

// Pub/Sub clients for the Socket.io adapter
const pubClient = new Redis(REDIS_URL, redisOptions);
const subClient = pubClient.duplicate();

pubClient.on("connect", () => console.log("✅ Redis PubClient connected."));
pubClient.on("error", (err) => console.error("❌ Redis PubClient error:", err));
subClient.on("connect", () => console.log("✅ Redis SubClient connected."));
subClient.on("error", (err) => console.error("❌ Redis SubClient error:", err));

// ───────────────────────── Middleware ─────────────────────────
// 🔧 Trust proxy settings (for ngrok, load balancers, reverse proxies)
// This enables Express to read X-Forwarded-* headers correctly
app.set('trust proxy', true);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🛡️ Rate Limiting
const rateLimiter = require("./middleware/rateLimiter");
app.use(rateLimiter);

app.use(express.json({ limit: "50mb" })); // ✅ Increased limit for image uploads
app.use(morgan("dev"));

// Admin + public routes that don't depend on req.io
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

// Attach io + presence to req (for routes/middleware)
let io;
app.use((req, _res, next) => {
  req.io = io;
  req.presence = presence; // Redis-backed presence
  next();
});

// Health routes
app.get("/", (_req, res) => res.json({ ok: true, service: "community-talk" }));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, uptime: process.uptime() })
);

// 🔍 DEBUG: Socket rooms inspection endpoint
app.get("/debug/sockets", (_req, res) => {
  if (!io) return res.json({ error: "io not initialized" });

  const sockets = [];
  for (const [id, socket] of io.sockets.sockets) {
    sockets.push({
      id,
      userId: socket.user?.id,
      rooms: Array.from(socket.rooms),
      communityIds: socket.user?.communityIds || [],
    });
  }

  const rooms = {};
  for (const [roomName, socketIds] of io.sockets.adapter.rooms) {
    // Skip socket ID rooms (socket.io creates a room for each socket ID)
    if (!io.sockets.sockets.has(roomName)) {
      rooms[roomName] = socketIds.size;
    }
  }

  res.json({
    connectedSockets: sockets.length,
    sockets,
    rooms,
  });
});

// ───────────────────────── Socket.IO ─────────────────────────
io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
  path: "/socket.io",
  pingTimeout: 25000,
  pingInterval: 20000,
});

// 🔥 Scaling Socket.IO with Redis adapter
io.adapter(createAdapter(pubClient, subClient));

registerEventSockets(io);

const communityRoom = (id) => `community:${id}`;

// Token helper endpoints
app.use("/api", require("./routes/tokenRoutes"));

// Authenticate socket connections
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || "").split(" ")[1];

    console.log(
      "🔑 [Socket Auth] Handshake token:",
      token ? token.slice(0, 15) + "..." : "❌ None"
    );

    if (!token) return next(new Error("No token provided"));

    let decoded;
    try {
      // Mirror authenticate.js options as closely as possible
      decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],
        clockTolerance: 5,
      });
    } catch (err) {
      console.error("💥 Socket JWT verify error:", err.message);
      return next(new Error("Invalid token"));
    }

    console.log("✅ [Socket Auth] Token decoded:", decoded);

    // ✅ Prisma Auth
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return next(new Error("User not found"));

    // ✅ Use Member.memberStatus + role (not legacy `status`)
    const memberships = await prisma.member.findMany({
      where: {
        userId: user.id,
        memberStatus: "active",
      },
      select: { communityId: true },
    });

    const communityIds = memberships.map((m) => m.communityId);

    socket.user = {
      id: user.id,
      fullName: user.fullName || "",
      email: user.email,
      communityIds,
    };

    next();
  } catch (err) {
    console.error("💥 Socket Auth Error:", err.message || err);
    next(new Error("Invalid token"));
  }
});

// ───────────────────────── Realtime Logic ─────────────────────────
io.on("connection", async (socket) => {
  const uid = socket.user?.id;
  const communities = socket.user?.communityIds || [];
  if (!uid) return;

  console.log(`🔌 ${uid} connected (${socket.id})`);
  console.log(`   User communities from Prisma:`, communities);

  // Track online presence (Redis-backed)
  const { isFirstConnection } = await presence.connect(uid);

  // Join personal + community rooms
  socket.join(uid);
  for (const cid of communities) {
    const roomName = communityRoom(cid);
    socket.join(roomName);
    console.log(`   ✅ Auto-joined room: ${roomName}`);
    await presence.joinCommunity(uid, cid);
  }

  console.log(`   All socket rooms:`, Array.from(socket.rooms));

  // Initial room info for client
  socket.emit("rooms:init", {
    userId: uid,
    communities,
  });

  // Only emit "online" once per logical user
  if (isFirstConnection) {
    io.emit("presence:update", { userId: uid, status: "online" });
  }

  // Manual community join/leave
  socket.on("community:join", async (cid) => {
    const roomName = communityRoom(cid);
    console.log(`🔵 [BACKEND] User ${uid} joining community room: ${roomName}`);
    console.log(`   Before join - Socket rooms:`, Array.from(socket.rooms));

    socket.join(roomName);

    console.log(`   After join - Socket rooms:`, Array.from(socket.rooms));
    console.log(`   Verification - InRoom: ${socket.rooms.has(roomName)}`);

    // ✅ Sync socket user state so typing checks pass
    if (socket.user && socket.user.communityIds && !socket.user.communityIds.includes(cid)) {
      console.log(`🔄 [BACKEND] Adding ${cid} to socket.user.communityIds for ${uid}`);
      socket.user.communityIds.push(cid);
    }

    await presence.joinCommunity(uid, cid);
  });

  socket.on("community:leave", async (cid) => {
    const roomName = communityRoom(cid);
    console.log(`🔴 [BACKEND] User ${uid} leaving community room: ${roomName}`);
    console.log(`   Before leave - Socket rooms:`, Array.from(socket.rooms));

    socket.leave(roomName);

    console.log(`   After leave - Socket rooms:`, Array.from(socket.rooms));
    await presence.leaveCommunity(uid, cid);
  });

  // 🔷 Bulk subscribe to communities (from SocketContext.tsx)
  socket.on("subscribe:communities", async ({ ids }) => {
    if (!Array.isArray(ids)) return;

    for (const cid of ids) {
      const roomName = communityRoom(cid);
      socket.join(roomName);

      // Update socket user state so typing/membership checks pass
      if (socket.user?.communityIds && !socket.user.communityIds.includes(cid)) {
        socket.user.communityIds.push(cid);
      }

      await presence.joinCommunity(uid, cid);
    }

    console.log(`🔷 [BACKEND] User ${uid} bulk-subscribed to ${ids.length} communities`);
    console.log(`   Rooms after bulk subscribe:`, Array.from(socket.rooms));
  });

  // 🔥 Secure message handler with XSS protection
  socket.on("message:send", async (msg) => {
    const clientMessageId = msg?.clientMessageId;

    try {
      const { communityId, content, replyTo } = msg;

      if (!content || !communityId) {
        console.warn(`[SECURITY] User ${uid} sent empty/invalid message.`);
        return;
      }

      // 🔒 SECURITY FIX: Sanitize content to prevent XSS
      const sanitizedContent = DOMPurify.sanitize(content);
      if (!sanitizedContent) {
        console.warn(`[SECURITY] User ${uid} sent purely malicious content.`);
        return;
      }

      // ✅ SECURITY: Ensure user is actually a member of this community
      const isMember = socket.user.communityIds.includes(communityId);
      if (!isMember) {
        console.warn(
          `[SECURITY] User ${uid} tried to post to community ${communityId} WITHOUT membership.`
        );
        socket.emit("message:error", {
          clientMessageId,
          error: "Unauthorized",
        });
        return;
      }

      // 📩 Process replyTo data if present
      let sanitizedReplyTo = undefined;
      if (replyTo && replyTo.messageId && replyTo.sender && replyTo.content) {
        sanitizedReplyTo = {
          messageId: replyTo.messageId,
          sender: DOMPurify.sanitize(replyTo.sender),
          content: DOMPurify.sanitize(replyTo.content.substring(0, 200)), // Truncate preview
        };
        console.log('📩 [SOCKET REPLY] Processing reply to:', sanitizedReplyTo);
      }

      // Save message (Prisma)
      const saved = await prisma.message.create({
        data: {
          communityId,
          content: sanitizedContent,
          senderId: uid,
          senderName: socket.user.fullName || socket.user.email, // Snapshot
          clientMessageId,
          replyToSnapshot: sanitizedReplyTo ? sanitizedReplyTo : undefined, // JSON
          // If using relation for replyTo
          replyToId: sanitizedReplyTo?.messageId ? sanitizedReplyTo.messageId : undefined,
          status: "sent",
        },
      });

      const payload = {
        ...saved,
        clientMessageId,
      };

      // Broadcast to community
      io.to(communityRoom(communityId)).emit("receive_message", payload);

      // Ack to sender (swap pending bubble)
      socket.emit("message:ack", {
        clientMessageId,
        serverId: saved._id,
      });
    } catch (err) {
      console.error("💥 Socket message send error:", err);
      socket.emit("message:error", { clientMessageId });
    }
  });

  // 📨 Message Delivery Receipt
  socket.on("message:delivered", async ({ messageId }) => {
    try {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (message && message.status === "sent") {
        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { status: "delivered", deliveredAt: new Date() },
        });
        // Notify sender
        io.to(updated.senderId).emit("message:status", {
          messageId,
          status: "delivered",
          deliveredAt: updated.deliveredAt,
        });
      }
    } catch (err) {
      console.error("💥 Message delivered error:", err);
    }
  });

  // 📖 Message Read Receipt
  socket.on("message:read", async ({ messageId }) => {
    try {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (message && message.status !== "deleted") {
        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { status: "read", readAt: new Date() },
        });
        // Notify sender
        io.to(updated.senderId).emit("message:status", {
          messageId,
          status: "read",
          readAt: updated.readAt,
        });
      }
    } catch (err) {
      console.error("💥 Message read error:", err);
    }
  });

  // ⌨️ Typing Indicator - Community
  socket.on("community:typing", ({ communityId, isTyping }) => {
    try {
      console.log(`⌨️ [BACKEND] Received typing event: user=${uid}, community=${communityId} (${typeof communityId}), isTyping=${isTyping}`);

      // Ensure communityIds exists
      const userCommunities = socket.user.communityIds || [];
      const isMember = userCommunities.includes(communityId);

      // DEBUG: Check if user is actually in the room
      const roomName = communityRoom(communityId);
      const inRoom = socket.rooms.has(roomName);
      console.log(`🔍 [BACKEND] Debug: Room=${roomName}, InRoom=${inRoom}, IsMember=${isMember}`);
      console.log(`   Socket Rooms:`, Array.from(socket.rooms));

      if (isMember) {
        console.log(`✅ [BACKEND] User is member, broadcasting to room: ${roomName}`);
        socket.to(roomName).emit("user:typing", {
          userId: uid,
          fullName: socket.user.fullName,
          communityId,
          isTyping
        });
        console.log(`📤 [BACKEND] Emitted user:typing event`);
      } else {
        console.log(`❌ [BACKEND] User is NOT a member of community ${communityId}`);
        console.log(`   User's communities:`, userCommunities);
      }
    } catch (err) {
      console.error("💥 Community typing error:", err);
    }
  });

  // ⌨️ Typing Indicator - Direct Message
  socket.on("dm:typing", ({ recipientId, isTyping }) => {
    try {
      io.to(recipientId).emit("dm:typing", {
        userId: uid,
        fullName: socket.user.fullName,
        isTyping
      });
    } catch (err) {
      console.error("💥 DM typing error:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    if (!uid) return;

    const { isLastConnection } = await presence.disconnect(uid);

    if (isLastConnection) {
      io.emit("presence:update", { userId: uid, status: "offline" });

      // Clean up community-level presence
      const userCommunities = await presence.listCommunitiesForUser(uid);
      await presence.leaveCommunities(uid, userCommunities);
    }

    console.log(`❌ ${uid} disconnected (${socket.id})`);
  });
});

// ───────────────────────── Routes ─────────────────────────
// Auth / registration
app.use("/api", personRoutes);

// ✅ User routes (avatar upload) - MUST come before dating routes
app.use("/api/user", userRoutes);

// Dating routes (secured by authenticate + per-route checks inside)
app.use("/api/dating", authenticate, datingRoutes);

// Core app routes
app.use("/api/communities", authenticate, communityRoutes);
app.use("/api/members", authenticate, memberRoutes);
app.use("/api/messages", authenticate, messageRoutes);
app.use("/api/direct-messages", authenticate, directMessageRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);
// ⭐ NEW: User Reporting Route (Authenticated)
app.use("/api/reports", authenticate, userReportRoutes);
// ⭐ Safety & Moderation Routes (Authenticated)
app.use("/api/safety", authenticate, safetyRoutes);
// Reactions routes (emoji reactions on messages)
app.use("/api/reactions", authenticate, reactionRoutes);
// Two-Factor Authentication routes
app.use("/api/2fa", twoFactorRoutes);
// Events routes with pre-auth logging
app.use("/api/events", (req, _res, next) => {
  console.log("🧭 [/api/events pre-auth]");
  console.log("→ originalUrl:", req.originalUrl);
  console.log("→ method:", req.method);
  console.log("→ headers.authorization:", req.headers?.authorization);
  console.log("→ headers.Authorization:", req.headers?.Authorization);
  console.log("→ x-access-token:", req.headers?.["x-access-token"]);
  next();
});
app.use("/api/events", authenticate, eventRoutes);
app.use('/api/upload', uploadRoutes);

// 🔒 SECURITY FIX: Test push endpoint now requires authentication
app.post("/api/test-push", authenticate, async (req, res) => {
  try {
    const expo = new Expo();
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ error: "Missing expoPushToken" });
    }

    const messages = [
      {
        to: expoPushToken,
        sound: "default",
        body: "🚀 Test push working (now requires auth)",
      },
    ];

    const receipts = await expo.sendPushNotificationsAsync(messages);
    res.json({ ok: true, receipts });
  } catch (err) {
    console.error("💥 Test push failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("💥 Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server Error" });
});

// ───────────────────────── Startup ─────────────────────────
const os = require("os");

/** Best guess of a LAN IPv4 address for logs */
function getLanIPv4() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface && iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// Process-level guards
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled promise rejection:", reason);
});

(async () => {
  try {
    // Verify Prisma Connection
    await prisma.$connect();
    console.log("✅ Prisma connected to Postgres.");

    const HOST = "0.0.0.0";
    const lanIp = getLanIPv4();

    const listen = () => {
      server.listen(PORT, HOST, () => {
        const localUrl = `http://localhost:${PORT}`;
        const lanUrl = `http://${lanIp}:${PORT}`;

        console.log(`✅ Server is up on port ${PORT}!`);
        console.log(`   • Local:  ${localUrl}`);
        console.log(`   • LAN:    ${lanUrl}`);
        console.log(`🔗 CORS allowed origins: ${ORIGIN.join(", ")}`);
        console.log(`🛡️  NODE_ENV=${process.env.NODE_ENV || "development"}`);
        console.log(`🔑 JWT configured: ${!!JWT_SECRET}`);
        console.log("🩺 Health check:", `${lanUrl}/health`);
      });
    };

    if (require.main === module) {
      listen();
    }

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

      // Close Redis connections
      redisClient.quit();
      pubClient.quit();
      subClient.quit();

      server.close((err) => {
        if (err) {
          console.error("Error during server close:", err);
          process.exit(1);
        }
        console.log("✅ Server closed.");
        process.exit(0);
      });

      // Force exit after 5s
      setTimeout(() => {
        console.warn("⚠️ Forcing shutdown after 5s.");
        process.exit(1);
      }, 5000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Server start failed:", err);
    process.exit(1);
  }
})();

module.exports = { app, server };