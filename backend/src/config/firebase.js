// backend/src/config/firebase.js
const admin = require("firebase-admin");

// Download service account key from Firebase Console
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Add your Firebase project config
});

module.exports = admin;
