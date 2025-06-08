const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

// Initialize without loading the file
try {
  admin.initializeApp({
    credential: admin.credential.cert(
      path.join(
        __dirname,
        "../config/angkutan-system-firebase-adminsdk-fbsvc-35bb803ee3.json"
      )
    ),
  });
} catch (error) {
  console.error("Firebase initialization error:", error);
}

module.exports = admin;
