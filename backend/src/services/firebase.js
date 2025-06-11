const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

const serviceAccount = require(path.join(
  __dirname,
  "../config/angkutan-system-firebase-adminsdk-fbsvc-35bb803ee3.json"
));

// Initialize without loading the file
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK Initialized successfully!");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

module.exports = admin;
