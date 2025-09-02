// src/routes/web/deliveryOrder.routes.js
const express = require("express");
const router = express.Router();
const webDOController = require("../../controllers/web/deliveryOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");

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
router.get(
  "/utils/recent-customers",
  checkRole(["admin", "owner"]),
  webDOController.getRecentCustomers
);
router.get(
  "/utils/recent-locations",
  checkRole(["admin", "owner"]),
  webDOController.getRecentLocations
);
router.post(
  "/",
  checkRole(["admin", "owner"]),
  webDOController.createDeliveryOrder
);
router.post(
  "/batch",
  checkRole(["admin", "owner"]),
  webDOController.createBatchDeliveryOrder
);

// Admin: confirm load with surat jalan photos and complete DO in one shot
router.post(
  "/:id/admin-complete",
  checkRole(["admin", "owner"]),
  upload.array("surat_jalan_photos", 5),
  webDOController.adminConfirmLoadAndComplete
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
