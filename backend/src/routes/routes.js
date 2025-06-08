const express = require("express");
const router = express.Router();
const admin = require("../services/firebase");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../utils/db");

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user from database
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/test-firebase", async (req, res) => {
  try {
    // Try to list users (requires auth)
    const listUsers = await admin.auth().listUsers(1);
    res.json({
      success: true,
      message: "Firebase Admin SDK is properly configured",
      firstUser: listUsers.users[0]
        ? listUsers.users[0].email
        : "No users found",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Firebase configuration error",
      error: error.message,
    });
  }
});

// Simple test route
router.get("/firebase-status", (req, res) => {
  try {
    const app = admin.app();
    res.json({
      success: true,
      message: "Firebase properly initialized",
      projectId: app.options.projectId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Firebase initialization error",
      error: error.message,
    });
  }
});

// Add this near your other routes
router.get("/test-auth", async (req, res) => {
  try {
    // Create a test user token
    const customToken = await admin.auth().createCustomToken("test-user");
    res.json({
      message: "Firebase Auth is working",
      testToken: customToken,
    });
  } catch (error) {
    res.status(500).json({
      error: "Firebase Auth error",
      details: error.message,
    });
  }
});

module.exports = router;
