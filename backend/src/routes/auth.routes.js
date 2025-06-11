const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/auth.controller");
const {
  validateRegistration,
  validateLogin,
} = require("../middlewares/validation.middleware");

router.post("/register", validateRegistration, register);
router.post("/login", validateLogin, login);

module.exports = router;
