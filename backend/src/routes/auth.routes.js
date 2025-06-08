const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/auth.controller");
const {
  validateRegistration,
} = require("../middlewares/validation.middleware");

router.post("/register", validateRegistration, register);
router.post("/login", login);

module.exports = router;
