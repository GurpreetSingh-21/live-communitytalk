// test-security.js (v4 - More Patient)
// A Node.js script to test for Broken Access Control vulnerabilities (OWASP A01).

const { io } = require("socket.io-client");

// --- Configuration ---
const SERVER_URL = "http://localhost:3000";

// This is the token for the "ssa" user.
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MGE1YTU2ZDViMDJlOGI1ZGRkZDU5YyIsImVtYWlsIjoic3NhQHFtYWlsLmN1bnkuZWR1IiwiZnVsbE5hbWUiOiJzczEiLCJpYXQiOjE3NjIzNzE0MDksImV4cCI6MTc2MzU4MTAwOX0.ZaNFH9S1rXgO79pj-NwpNKKN_P1s84uKpu1xwsFoFp4";

// The "good" community that "ssa" *IS* a member of
const GOOD_COMMUNITY_ID = "68e49d1e35da2b0da14ee030"; // Sikh @ Queens College

// A community that "ssa" is *NOT* a member of
const MALICIOUS_COMMUNITY_ID = "68e49d0035da2b0da14ee011"; // A FAKE ID

// We will send 10 users. 5 will be good, 5 will be attackers.
const TOTAL_USERS = 10; 
const USER_ARRIVAL_MS = 2000; // 1 user every 2 seconds
// ---------------------

let testSuccesses = 0;
let testFailures = 0;
let connectionErrors = 0;
let goodMessages = 0;

console.log(`🚀 Starting SECURITY TEST against ${SERVER_URL}...`);
console.log(`Simulating ${TOTAL_USERS} users.\n`);

/**
 * Creates and simulates one virtual user.
 */
function createVirtualUser(userId) {
  // Even-numbered users are "good", odd-numbered are "attackers"
  const isAttacker = userId % 2 !== 0;
  const userType = isAttacker ? "Attacker" : "Good User";
  
  const socket = io(SERVER_URL, {
    auth: { token: TOKEN },
    transports: ["websocket"],
    timeout: 5000, // Local server is fast
  });

  socket.on("connect", () => {
    console.log(`[User ${userId} (${userType})]: 🔌 Connected!`);

    if (isAttacker) {
      runAttackerScenario(userId, socket);
    } else {
      runGoodUserScenario(userId, socket);
    }
  });

  socket.on("connect_error", (err) => {
    connectionErrors++;
    console.error(`[User ${userId} (${userType})]: 💥 Connection Error: ${err.message}`);
  });
}

/**
 * Attacker Scenario: Try to send a message to a community they haven't joined.
 */
function runAttackerScenario(userId, socket) {
  const attackPayload = {
    communityId: MALICIOUS_COMMUNITY_ID,
    content: "This is a malicious message.",
    clientMessageId: `attack-${userId}-${Date.now()}`,
  };

  console.log(`[User ${userId} (Attacker)]: 🎯 Attempting to send message to forbidden community (${MALICIOUS_COMMUNITY_ID})...`);
  
  // Listen for the server's response
  socket.on("message:ack", (data) => {
    if (data.clientMessageId === attackPayload.clientMessageId) {
      console.error(`[User ${userId} (Attacker)]: 🟥 FAILED (VULNERABLE!) - Server accepted malicious message (ack)`);
      testFailures++;
    }
  });
  
  socket.on("message:error", (data) => {
    if (data.clientMessageId === attackPayload.clientMessageId) {
      console.log(`[User ${userId} (Attacker)]: 🟩 PASSED (SECURE) - Server correctly rejected message.`);
      testSuccesses++;
    }
  });
  
  socket.emit("message:send", attackPayload);
  
  // ----------------------------------------------------
  // ✅ FIX: Wait 30 seconds now. This is very patient.
  // ----------------------------------------------------
  setTimeout(() => socket.disconnect(), 30000);
}

/**
 * Good User Scenario: Join and send a message (a "control" test).
 */
function runGoodUserScenario(userId, socket) {
  console.log(`[User ${userId} (Good User)]: 👍 Joining good community (${GOOD_COMMUNITY_ID})...`);
  socket.emit("community:join", GOOD_COMMUNITY_ID);
  
  const message = {
    communityId: GOOD_COMMUNITY_ID,
    content: "This is a normal message.",
    clientMessageId: `good-${userId}-${Date.now()}`,
  };

  // Added a listener to confirm good messages work.
  socket.on("message:ack", (data) => {
     if (data.clientMessageId === message.clientMessageId) {
        console.log(`[User ${userId} (Good User)]: ✅ Good message sent successfully.`);
        goodMessages++;
     }
  });

  socket.emit("message:send", message);
  
  // ----------------------------------------------------
  // ✅ FIX: Wait 30 seconds now. This is very patient.
  // ----------------------------------------------------
  setTimeout(() => socket.disconnect(), 30000);
}


// Main loop to start the simulation
for (let i = 0; i < TOTAL_USERS; i++) {
  setTimeout(() => {
    createVirtualUser(i + 1);
  }, i * USER_ARRIVAL_MS);
}

// ----------------------------------------------------
// ✅ FIX: Increased total test time to let all users finish.
// (10 users * 2s) + 30s test time + 5s buffer = 55 seconds
// ----------------------------------------------------
const totalTestTime = (TOTAL_USERS * USER_ARRIVAL_MS) + 30000 + 5000;

setTimeout(() => {
  console.log("\n--- Security Test Finished ---");
  console.log(`👍 Good Messages Sent: ${goodMessages}`);
  console.log(`🟩 Secure Tests (PASSED): ${testSuccesses}`);
  console.log(`🟥 Vulnerable Tests (FAILED): ${testFailures}`);
  console.log(`💥 Connection Errors: ${connectionErrors}`);
  
  if (testFailures > 0) {
    console.error("\n🚨 VULNERABILITY DETECTED! Your server is accepting messages from users not in that community.");
  } else if (testSuccesses > 0) {
    console.log("\n✅ Security check passed! Your server correctly blocked the attackers.");
  } else {
    console.log("\n🤔 No security tests were fully completed. Check for connection errors or bad test data.");
  }
  
  process.exit(0);
}, totalTestTime);