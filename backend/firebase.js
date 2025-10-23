// backend/firebase.js
const admin = require("firebase-admin");
const serviceAccount = require("./community-talk-88cf5-firebase-adminsdk-fbsvc-6eed8fac43.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;