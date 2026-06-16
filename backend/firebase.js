// backend/firebase.js
// SECURITY FIX (CRIT-1): Removed hardcoded serviceAccountKey.json file.
// Private key is now loaded exclusively from environment variables.
// ACTION REQUIRED: Revoke the old key at Google Cloud Console → IAM → Service Accounts
// and add the new FIREBASE_* variables to your .env file and Render dashboard.
const admin = require("firebase-admin");

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_PRIVATE_KEY ||
  !process.env.FIREBASE_CLIENT_EMAIL
) {
  console.warn(
    "⚠️ [Firebase] Missing FIREBASE_* env vars. Push notifications will be disabled. " +
    "Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_PRIVATE_KEY_ID, " +
    "FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID in your .env file."
  );
}

let adminInstance;

try {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // Render / Heroku encode newlines as \n in env vars — restore them
    private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "",
    universe_domain: "googleapis.com",
  };

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  adminInstance = admin;
} catch (err) {
  console.error("❌ [Firebase] Failed to initialize Admin SDK:", err.message);
  adminInstance = null;
}

module.exports = adminInstance;