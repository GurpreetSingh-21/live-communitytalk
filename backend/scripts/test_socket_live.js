const { io } = require("socket.io-client");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "../.env" });

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.MY_SECRET_KEY;

async function run() {
  console.log("🚀 Starting Socket.IO Live Test...");

  try {
    // 1. Get a test user and community
    const member = await prisma.member.findFirst({
      where: { memberStatus: "active" },
      include: { user: true, community: true }
    });

    if (!member) {
      console.error("❌ No active members found in DB to test with.");
      process.exit(1);
    }

    const { user, community } = member;
    console.log(`👤 User: ${user.fullName} (${user.id})`);
    console.log(`🏘️ Community: ${community.name} (${community.id})`);

    // 2. Generate Token
    const token = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    console.log("🔑 Token generated.");

    // 3. Connect Socket
    const socket = io(URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"]
    });

    await new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log(`✅ Connected to Socket.IO: ${socket.id}`);
        resolve();
      });
      socket.on("connect_error", (err) => {
        console.error("❌ Connection failed:", err.message);
        reject(err);
      });
      setTimeout(() => reject(new Error("Timeout connecting")), 5000);
    });

    // 4. Join Community Room
    console.log(`➡ Joining room: community:${community.id}`);
    socket.emit("community:join", community.id);
    
    // Allow time to join
    await new Promise(r => setTimeout(r, 1000));

    // 5. Setup Listener & Send Message
    const testMsgId = `test_${Date.now()}`;
    
    const receivePromise = new Promise((resolve, reject) => {
      socket.on("receive_message", (payload) => {
        if (payload.clientMessageId === testMsgId) {
          console.log("✅ RECEIVED BROADCAST MESSAGE:");
          console.log(`   Content: "${payload.content}"`);
          console.log(`   From: ${payload.senderName}`);
          resolve(payload);
        }
      });
      setTimeout(() => reject(new Error("Timeout waiting for message broadcast")), 8000);
    });

    console.log("📤 Sending Test Message...");
    socket.emit("message:send", {
      clientMessageId: testMsgId,
      communityId: community.id,
      content: "🤖 Automated Socket Test Message (Verify Live Update)",
    });

    await receivePromise;
    console.log("\n🎉 TEST PASSED: Socket.IO is broadcasting correctly!");

    // Clean up
    socket.disconnect();

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
