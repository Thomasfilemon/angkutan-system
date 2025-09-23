// src/routes/web/recap.routes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth.middleware");
const recapController = require("../../controllers/web/recapController");

router.use(verifyToken);

router.post("/", recapController.createRecap);
router.get("/", recapController.listRecaps);
router.get("/:id", recapController.getRecapDetail);
router.post("/:recap_id/items", recapController.addItemToRecap);
router.post("/:recap_id/pay", recapController.payRecap);

module.exports = router;
