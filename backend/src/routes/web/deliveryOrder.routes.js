// src/routes/web/deliveryOrder.routes.js
const express = require("express");
const router = express.Router();
const webDOController = require("../../controllers/web/deliveryOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");
const uploadMemory = require("../../middlewares/uploadMemory.middleware");

router.use(verifyToken);

// Debug middleware to verify that web DO router is actually handling requests
router.use((req, res, next) => {
  console.log(
    `[WEB DO ROUTER] ${req.method} ${req.originalUrl} (user: ${
      req.user?.username || "unknown"
    })`
  );
  next();
});

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
// Use memory upload so we can stream files to Google Drive
router.post(
  "/:id/admin-complete",
  checkRole(["admin", "owner"]),
  uploadMemory.array("surat_jalan_photos", 5),
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

// Hard delete for standalone DOs (no PO, already cancelled)
router.delete(
  "/:id",
  checkRole(["admin", "owner"]),
  webDOController.deleteStandaloneDeliveryOrder
);

module.exports = router;
