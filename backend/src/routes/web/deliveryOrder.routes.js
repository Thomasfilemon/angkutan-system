// src/routes/web/deliveryOrder.routes.js
const express = require("express");
const router = express.Router();
const webDOController = require("../../controllers/web/deliveryOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// ✅ Core DO management routes
router.get(
  "/",
  checkRole(["admin", "owner"]),
  webDOController.getAllDeliveryOrders
);
router.get(
  "/statistics",
  checkRole(["admin", "owner"]),
  webDOController.getDeliveryStatistics
);
router.post(
  "/",
  checkRole(["admin", "owner"]),
  webDOController.createDeliveryOrder
);
router.get(
  "/:id",
  checkRole(["admin", "owner"]),
  webDOController.getDeliveryOrderById
);
router.put(
  "/:id",
  checkRole(["admin", "owner"]),
  webDOController.updateDeliveryOrder
);
router.patch(
  "/:id/cancel",
  checkRole(["admin", "owner"]),
  webDOController.cancelDeliveryOrder
);
router.patch(
  "/:id/complete-deposit",
  checkRole(["admin", "owner"]),
  webDOController.completeDeliveryOrder
);

module.exports = router;
