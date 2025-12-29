// backend/src/routes/auth.routes.js

const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
// === PERBAIKAN: Import checkRole, bukan requireOwner ===
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");
const {
  validateLogin,
  validateRegistration,
} = require("../middlewares/validation.middleware");

// Login routes
router.post("/mobile/login", ...validateLogin, authController.mobileLogin);
router.post("/web/login", ...validateLogin, authController.webLogin);

// Protected register route (admin (and owner) can register new users)
router.post(
  "/register",
  verifyToken,
  checkRole(["owner", "admin"]),
  ...validateRegistration,
  authController.register
);

// Validate Token Endpoint
router.get("/validate", verifyToken, authController.validateToken);

// Logout Endpoint
router.post("/logout", verifyToken, authController.logout);

module.exports = router;
