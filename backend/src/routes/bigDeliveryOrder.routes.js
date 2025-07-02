const express = require("express");
const router = express.Router();
const mobileBigDOController = require("../controllers/bigDeliveryOrder.controller");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");

router.use(verifyToken);

// Get driver's active Big DO
router.get(
  "/driver/:driver_id/active",
  checkRole(["driver"]),
  mobileBigDOController.getDriverActiveBigDO
);

// Start Big DO (driver confirms assignment)
router.patch(
  "/:id/start",
  checkRole(["driver"]),
  mobileBigDOController.startBigDeliveryOrder
);

// Complete Big DO (driver completes all deliveries)
router.patch(
  "/:id/complete",
  checkRole(["driver"]),
  mobileBigDOController.completeBigDeliveryOrder
);

// Get Big DO details with individual DOs
router.get(
  "/:id",
  checkRole(["driver"]),
  mobileBigDOController.getBigDeliveryOrderById
);

module.exports = router;
