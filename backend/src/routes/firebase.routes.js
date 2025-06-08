const express = require("express");
const router = express.Router();
const {
  testAuth,
  protectedRoute,
} = require("../controllers/firebase.controller");
const verifyFirebaseToken = require("../utils/verifyFirebaseToken");

router.get("/test-auth", testAuth);
router.get("/protected", verifyFirebaseToken, protectedRoute);

module.exports = router;
