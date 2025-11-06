// test-cluster-load.js
// This script runs a LOAD TEST against your local CLUSTER.

const { io } = require("socket.io-client");

// --- Configuration ---
const SERVER_URL = "http://localhost:3000"; // The Load Balancer

// We'll alternate tokens for the users to add variation
const TOKENS = [
  // Token for User "S"
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjIzMjBiMTFlNjBmODEyODY2NWMwNSIsImVtYWlsIjoic3NAcW1haWwuY3VueS5lZHUiLCJmdWxsTmFtZSI6IlMiLCJpYXQiOjE3NjI0NTY1NzYsImV4cCI6MTc2MzY2NjE3Nn0.dRBIa4uGWKLwOybo3jb1FRNT65zbPMJgbOEmdrmnHxA",
  // Token for User "sssa"
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MGNmM2JiY2RmMWQ5N2Y1YWM2YTE5NCIsImVtYWlsIjoic3NzYUBxbWFpbC5jdW55LmVkdSIsImZ1bGxOYW1lIjoic3NzYSIsImlhdCI6MTc2MjQ1NjUxNiwiZXhwIjoxNzYzNjY2MTE2fQ.trVPiJI6Yw0PRLTdkS7XE-T4uDcmynAkQRtHjbxS1gg"
];

const COMMUNITY_ID = "68e49d1e35da2b0da14ee030";

// --- Test Parameters ---
const TOTAL_USERS = 500; // Total users to simulate
const USER_ARRIVAL_MS = 200; // 1 new user every 200ms (5 users/sec)
const MESSAGES_PER_USER = 3;
const MESSAGE_INTERVAL_MS = 4000; // 4 seconds
// ---------------------

let connectedUsers = 0;
let messagesSent = 0;
let messagesAcked = 0;
let connectionErrors = 0;

console.log(`🚀 Starting Cluster LOAD TEST against ${SERVER_URL}...`);
console.log(`Simulating ${TOTAL_USERS} users, 1 every ${USER_ARRIVAL_MS}ms.\n`);

/**
 * Creates and simulates one virtual user.
 */
function createVirtualUser(userId) {
  const token = TOKENS[userId % TOKENS.length]; // Alternate between the two tokens
  
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 10000,
  });

  socket.on("connect", () => {
    connectedUsers++;
    console.log(`[User ${userId}]: 🔌 Connected.`);
    socket.emit("community:join", COMMUNITY_ID);

    let messagesSentByUser = 0;
    const interval = setInterval(() => {
      if (messagesSentByUser >= MESSAGES_PER_USER) {
        clearInterval(interval);
        socket.disconnect();
        return;
      }

      const message = {
        communityId: COMMUNITY_ID,
        content: `Cluster load test message ${messagesSentByUser + 1}`,
        clientMessageId: `cluster-load-${userId}-${messagesSentByUser}`,
      };

      socket.emit("message:send", message);
      messagesSent++;
      messagesSentByUser++;
    }, MESSAGE_INTERVAL_MS + Math.random() * 1000); // Add jitter
  });

  socket.on("message:ack", () => {
    messagesAcked++;
  });

  socket.on("disconnect", () => {
    connectedUsers--;
  });

  socket.on("connect_error", (err) => {
    connectionErrors++;
    console.error(`[User ${userId}]: 💥 Connection Error: ${err.message}`);
  });
}

// Main loop to start the simulation
for (let i = 0; i < TOTAL_USERS; i++) {
  setTimeout(() => {
    createVirtualUser(i + 1);
  }, i * USER_ARRIVAL_MS);
}

// Log a summary at the end
const totalTestTime = (TOTAL_USERS * USER_ARRIVAL_MS) + (MESSAGES_PER_USER * MESSAGE_INTERVAL_MS) + 5000;

setTimeout(() => {
  console.log("\n--- Cluster Load Test Finished ---");
  console.log(`Total Messages Sent: ${messagesSent}`);
  console.log(`Total Messages Acknowledged (Acked): ${messagesAcked}`);
  console.log(`Total Connection Errors: ${connectionErrors}`);
  
  if (messagesSent > 0 && messagesAcked === messagesSent) {
    console.log("\n✅ TEST PASSED! All messages were sent and acknowledged.");
  } else if (messagesSent > 0 && messagesAcked < messagesSent) {
    console.warn(`\n⚠️ TEST WARNING: ${messagesSent - messagesAcked} messages were not acknowledged (likely due to timeouts).`);
  } else if (connectionErrors > 0) {
    console.error(`\n❌ TEST FAILED. ${connectionErrors} users failed to connect.`);
  }

  process.exit(0);
}, totalTestTime);