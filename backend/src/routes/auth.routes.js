const express = require("express");
const router = express.Router();

const { mobileLogin, webLogin, register } = require("../controllers/auth.controller");
const { verifyToken, requireOwner } = require("../middlewares/auth.middleware");
const { validateLogin, validateRegistration } = require("../middlewares/validation.middleware");

// Login routes
router.post("/mobile/login", ...validateLogin, mobileLogin); // <-- Use spread operator
router.post("/web/login", ...validateLogin, webLogin);       // <-- Use spread operator

// Protected register route (owner only)
router.post(
  "/register",
  verifyToken,
  requireOwner,
  ...validateRegistration, // <--- USE THE SPREAD (...) OPERATOR HERE
  register
);

module.exports = router;
