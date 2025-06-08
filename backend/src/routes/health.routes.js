const express = require("express");
const router = express.Router();
const { healthCheck, dbTest } = require("../controllers/health.controller");

router.get("/health", healthCheck);
router.get("/db-test", dbTest);

module.exports = router;
