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

// 🔌 Redis & Socket.io Adapter
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis"); // Using 'ioredis' for presence & pub/sub

// 🔌 Database
const { connectDB } = require("./db");

// 👥 Presence Tracker (This will be our new Redis-backed version)
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

// 📦 Models
const Person = require("./person");
const Member = require("./models/Member");
const Message = require("./models/Message");

// ⚙️ App + Server
const app = express();
const server = http.createServer(app);

// ───────────────────────── Configuration ─────────────────────────
const ORIGIN_ENV = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const ORIGIN = ORIGIN_ENV.split(",").map((o) => o.trim());
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.MY_SECRET_KEY;
if (!JWT_SECRET) console.warn("⚠️ Missing MY_SECRET_KEY — JWT auth will fail.");

// NEW: Redis Configuration
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
if (!process.env.REDIS_URL) {
  console.warn(
    "⚠️ Missing REDIS_URL. Using fallback. This is required for scaling."
  );
}
// We just need an empty object. Render's internal network does not use TLS.
const redisOptions = {};

// ───────────────────────── Redis & Presence Init ─────────────────────────
// Create one client for our new presence module
const redisClient = new Redis(REDIS_URL, redisOptions);

redisClient.on("connect", () =>
  console.log("✅ Redis connected for Presence.")
);
redisClient.on("error", (err) =>
  console.error("❌ Redis Presence error:", err)
);

// Pass the client to our new presence module
presence.init(redisClient);

// Create Pub/Sub clients for the Socket.io adapter
const pubClient = new Redis(REDIS_URL, redisOptions);
const subClient = pubClient.duplicate();

pubClient.on("connect", () => console.log("✅ Redis PubClient connected."));
pubClient.on("error", (err) => console.error("❌ Redis PubClient error:", err));
subClient.on("connect", () => console.log("✅ Redis SubClient connected."));
subClient.on("error", (err) => console.error("❌ Redis SubClient error:", err));

// ───────────────────────── Middleware ─────────────────────────
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
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

// Attach io + presence to req
let io;
app.use((req, _res, next) => {
  req.io = io;
  req.presence = presence; // Now req.presence is Redis-backed
  next();
});

// Health route
app.get("/", (_req, res) => res.json({ ok: true, service: "community-talk" }));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, uptime: process.uptime() })
);

// ───────────────────────── Socket.IO ─────────────────────────
io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
  path: "/socket.io",
  pingTimeout: 25000,
  pingInterval: 20000,
});

// 🔥 THIS IS THE KEY FOR SCALING SOCKET.IO 🔥
io.adapter(createAdapter(pubClient, subClient));

registerEventSockets(io /*, presence */);

const communityRoom = (id) => `community:${id}`;

// (From friend) Token endpoints
app.use("/api", require("./routes/tokenRoutes"));

// Authenticate socket
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || "").split(" ")[1];
    console.log(
      "🔑 [Socket Auth] Handshake token received:",
      token ? token.slice(0, 15) + "..." : "❌ None"
    );
    if (!token) return next(new Error("No token provided"));

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("✅ [Socket Auth] Token verified:", decoded);

    const user = await Person.findById(decoded.id).lean();
    if (!user) return next(new Error("User not found"));

    // ✅ use Member.memberStatus (not `status`)
    const memberships = await Member.find({
      person: user._id,
      memberStatus: { $in: ["active", "owner"] },
    }).select("community");
    const communityIds = memberships.map((m) => String(m.community));

    socket.user = {
      id: String(user._id),
      fullName: user.fullName || user.name || "",
      email: user.email,
      communityIds,
    };
    next();
  } catch (err) {
    // Catch the error object
    console.error("💥 Socket Auth Error:", err.message);
    next(new Error("Invalid token"));
  }
});

// ───────────────────────── Realtime Logic ─────────────────────────
io.on("connection", async (socket) => {
  const uid = socket.user?.id;
  const communities = socket.user?.communityIds || [];
  if (!uid) return; // Defensive check

  console.log(`🔌 ${uid} connected (${socket.id})`);

  // Track online presence (MODIFIED)
  // We no longer pass socket.id, just the user ID.
  const { isFirstConnection } = await presence.connect(uid);

  socket.join(uid);
  for (const cid of communities) {
    socket.join(communityRoom(cid));
    await presence.joinCommunity(uid, cid); // Also track community presence
  }

  // Notify UI
  socket.emit("rooms:init", {
    userId: uid,
    communities,
  });

  // (MODIFIED) Only emit 'online' if this is their *first* connection
  if (isFirstConnection) {
    io.emit("presence:update", { userId: uid, status: "online" });
  }

  // Manual room join (MODIFIED)
  socket.on("community:join", async (cid) => {
    socket.join(communityRoom(cid));
    await presence.joinCommunity(uid, cid);
  });
  socket.on("community:leave", async (cid) => {
    socket.leave(communityRoom(cid));
    await presence.leaveCommunity(uid, cid);
  });

  // ----------------------------------------------------
  // ✅ THIS IS THE HANDLER THAT WAS MISSING
  // ----------------------------------------------------
  // 🔥 Receive new message directly (with security patch)
  socket.on("message:send", async (msg) => {
    // Get the clientMessageId *outside* the try block
    const clientMessageId = msg?.clientMessageId;

    try {
      const { communityId, content } = msg;
      // const uid = socket.user?.id; // Already defined above

      if (!content || !communityId) {
        console.warn(`[SECURITY] User ${uid} sent empty message.`);
        return; // Don't reply, just ignore
      }

      // ----------------------------------------------------
      // ✅ SECURITY FIX (OWASP A01)
      // Check if the user is *actually* a member of this community.
      // ----------------------------------------------------
      const isMember = socket.user.communityIds.includes(communityId);
      if (!isMember) {
        // The user is an attacker.
        console.warn(
          `[SECURITY] User ${uid} tried to post to community ${communityId} WITHOUT membership.`
        );
        socket.emit("message:error", {
          clientMessageId: clientMessageId, // Send the ID back
          error: "Unauthorized",
        });
        return; // Stop processing.
      }
      // ----------------------------------------------------

      // Save message in DB (Only "Good Users" get here)
      const saved = await Message.create({
        communityId,
        content,
        senderId: uid,
        sender: socket.user.fullName || socket.user.email,
        timestamp: new Date(),
        clientMessageId,
      });

      // Broadcast to community instantly
      const payload = {
        ...saved.toObject(),
        clientMessageId,
      };
      io.to(communityRoom(communityId)).emit("receive_message", payload);

      // Confirm to sender (so UI replaces pending bubble)
      socket.emit("message:ack", { clientMessageId, serverId: saved._id });
    } catch (err) {
      console.error("💥 Socket message send error:", err);
      // Now our catch block can safely send the ID back
      socket.emit("message:error", { clientMessageId: clientMessageId });
    }
  });

  // Handle disconnect (MODIFIED)
  socket.on("disconnect", async () => {
    // This logic is now robust for multiple instances
    // We just pass uid, not socket.id
    if (!uid) return; // Handle cases where auth might have failed

    const { isLastConnection } = await presence.disconnect(uid);

    // If this was their *very last* socket across all instances
    if (isLastConnection) {
      io.emit("presence:update", { userId: uid, status: "offline" });

      // Clean up their community presence
      const userCommunities = await presence.listCommunitiesForUser(uid);
      await presence.leaveCommunities(uid, userCommunities);
    }
    console.log(`❌ ${uid} disconnected (${socket.id})`);
  });
});

// ───────────────────────── Routes ─────────────────────────
app.use("/api", personRoutes); // login/registration under /api (your original)
app.use("/api/communities", authenticate, communityRoutes);
app.use("/api/members", authenticate, memberRoutes);
app.use("/api/messages", authenticate, messageRoutes);
app.use("/api/direct-messages", authenticate, directMessageRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);

// 🔎 Pre-auth header logger for /api/events
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

app.post("/api/test-push", async (req, res) => {
  try {
    const { Expo } = require("expo-server-sdk");
    const expo = new Expo();

    const { expoPushToken } = req.body;
    if (!expoPushToken)
      return res.status(400).json({ error: "Missing expoPushToken" });

    const messages = [
      {
        to: expoPushToken,
        sound: "default",
        body: "🚀 Test push working (no auth)",
      },
    ];

    const receipts = await expo.sendPushNotificationsAsync(messages);
    res.json({ ok: true, receipts });
  } catch (err) {
    console.error("💥 Test push failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));
// Error handler
app.use((err, _req, res, _next) => {
  console.error("💥 Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server Error" });
});

// ───────────────────────── Startup ─────────────────────────
const os = require("os");

/** Best guess of a LAN IPv4 address to show in logs */
function getLanIPv4() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface && iface.family === "IPv4" && !iface.internal) {
        return iface.address; // e.g. 192.168.x.x
      }
    }
  }
  return "localhost";
}

// Helpful process-level guards in dev/prod
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled promise rejection:", reason);
});

(async () => {
  try {
    await connectDB();
    // Note: ioredis clients connect automatically,
    // so we don't need an explicit 'await pubClient.connect()' block
    // unless we were using 'node-redis' v4.

    const HOST = "0.0.0.0"; // bind to all interfaces
    const lanIp = getLanIPv4();

    server.listen(PORT, HOST, () => {
      const localUrl = `http://localhost:${PORT}`;
      const lanUrl = `http://${lanIp}:${PORT}`;
      // 🚀 MODIFIED to show the port
      console.log(`✅ Server is up on port ${PORT}!`);
      console.log(`   • Local:  ${localUrl}`);
      console.log(`   • LAN:    ${lanUrl}`);
      console.log(`🔗 CORS allowed origins: ${ORIGIN.join(", ")}`);
      console.log(`🛡️  NODE_ENV=${process.env.NODE_ENV || "development"}`);
      console.log(`🔑 JWT configured: ${!!JWT_SECRET}`);
      console.log("🩺 Health check:", `${lanUrl}/health`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      // NEW: Close Redis connections
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
