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

// 🔌 Database
const { connectDB } = require("./db");

// 👥 Presence Tracker
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
  req.presence = presence;
  next();
});

// Health route
app.get("/", (_req, res) => res.json({ ok: true, service: "community-talk" }));
app.get("/health", (_req, res) => res.status(200).json({ ok: true, uptime: process.uptime() }));

// ───────────────────────── Socket.IO ─────────────────────────
io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
  path: "/socket.io",
  pingTimeout: 25000,
  pingInterval: 20000,
});

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
  } catch {
    next(new Error("Invalid token"));
  }
});

// ───────────────────────── Realtime Logic ─────────────────────────
io.on("connection", (socket) => {
  const uid = socket.user?.id;
  const communities = socket.user?.communityIds || [];

  console.log(`🔌 ${uid} connected (${socket.id})`);

  // Track online presence
  presence.connect(uid, socket.id);
  socket.join(uid);
  for (const cid of communities) socket.join(communityRoom(cid));

  // Notify UI
  socket.emit("rooms:init", {
    userId: uid,
    communities,
  });

  io.emit("presence:update", { userId: uid, status: "online" });

  // Manual room join
  socket.on("community:join", (cid) => socket.join(communityRoom(cid)));
  socket.on("community:leave", (cid) => socket.leave(communityRoom(cid)));

  // 🔥 Receive new message directly (for instant echo)
  socket.on("message:send", async (msg) => {
    try {
      const { communityId, content, clientMessageId } = msg;
      if (!content || !communityId) return;

      // Save message in DB
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
      socket.emit("message:error", { clientMessageId: msg.clientMessageId });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    presence.disconnect(uid, socket.id);
    if (!presence.isOnline(uid)) {
      io.emit("presence:update", { userId: uid, status: "offline" });
    }
    console.log(`❌ ${uid} disconnected (${socket.id})`);
  });
});

// ───────────────────────── Routes ─────────────────────────
// keep auth’d API mounts
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

    const HOST = "0.0.0.0"; // bind to all interfaces
    const lanIp = getLanIPv4();

    server.listen(PORT, HOST, () => {
      const localUrl = `http://localhost:${PORT}`;
      const lanUrl = `http://${lanIp}:${PORT}`;
      console.log("✅ Server is up!");
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
      server.close((err) => {
        if (err) {
          console.error("Error during server close:", err);
          process.exit(1);
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Server start failed:", err);
    process.exit(1);
  }
})();