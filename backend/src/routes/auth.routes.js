const express = require("express");
const router = express.Router();
const {
  mobileLogin,
  webLogin,
  register,
} = require("../controllers/auth.controller");
const { verifyToken, requireOwner } = require("../middlewares/auth.middleware");

const {
  validateLogin,
  validateRegistration,
} = require("../middlewares/validation.middleware");

// Protected route for all authenticated users
// router.get("/profile", verifyToken, profileController.getProfile);

// Login routes
router.post("/mobile/login", validateLogin, mobileLogin); // Mobile app authentication (admin & driver)
router.post("/web/login", validateLogin, webLogin); // Web authentication (owner only)

// Protected registration route (owner only)
router.post(
  "/register",
  verifyToken,
  requireOwner,
  validateRegistration,
  register
);

// Protected route only for admins
// router.post(
//   "/assign-task",
//   verifyToken,
//   requireRole(["admin"]),
//   taskController.assignTask
// );

module.exports = router;
