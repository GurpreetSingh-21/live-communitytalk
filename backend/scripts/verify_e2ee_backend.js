const axios = require('axios');
require('dotenv').config({ path: '../.env' });

const API_URL = 'http://localhost:3000/api';
// Use the credentials from your previous successful login or register a temp user
// For this test we will try to login with a known user or just fail if not possible without interaction
// But since we are in a script, let's assume we can use the environment or hardcoded test creds
// Actually, let's try to register a quick temp user to be safe and clean.

const crypto = require('crypto');
const email = `e2ee_test_${crypto.randomBytes(4).toString('hex')}@example.com`;
const password = 'password123';
const collegeId = 'clrb...'; // We need a valid college ID. 
// Easier approach: Use the Login route if we have creds, or just rely on the user running this?
// I'll try to find a user from the DB first? No, I can't access DB directly comfortably without Prisma code.
// Let's use Prisma to get a user token!

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.MY_SECRET_KEY;

async function run() {
  try {
    console.log("1. Finding a test user...");
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error("No users found in DB to test with.");
      process.exit(1);
    }
    console.log(`   Found user: ${user.email} (${user.id})`);

    // Generate token locally to avoid login flow complexity
    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    console.log("   Generated test token.");

    // 2. Generate a fake public key
    const fakePublicKey = "TEST_PUB_KEY_" + Date.now();
    console.log(`2. Updating profile with publicKey: ${fakePublicKey}`);

    const patchRes = await axios.patch(
      `${API_URL}/profile`,
      { publicKey: fakePublicKey },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("   PATCH status:", patchRes.status);
    if (patchRes.status !== 200) {
      throw new Error("Failed to update profile");
    }

    // 3. Verify it was saved
    console.log("3. Verifying update...");
    // Retrieve via API
    const getRes = await axios.get(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const fetchedKey = getRes.data.user.publicKey;
    console.log(`   Fetched publicKey: ${fetchedKey}`);

    if (fetchedKey === fakePublicKey) {
      console.log("✅ SUCCESS: Public key updated and retrieved correctly!");
    } else {
      console.error("❌ FAILED: Key mismatch!");
    }

  } catch (err) {
    console.error("❌ Error:", err.response ? err.response.data : err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
