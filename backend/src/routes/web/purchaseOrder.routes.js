// src/routes/web/purchaseOrder.routes.js
const express = require("express");
const router = express.Router();
const webPOController = require("../../controllers/web/purchaseOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

// All routes are protected
router.use(verifyToken);

// Enhanced web routes for Purchase Orders
router.get(
  "/",
  checkRole(["admin", "owner"]),
  webPOController.getAllPurchaseOrders
);
router.post(
  "/",
  checkRole(["admin", "owner"]),
  webPOController.createPurchaseOrder
);
router.get(
  "/available-for-delivery",
  checkRole(["admin", "owner"]),
  webPOController.getAvailablePOsForDelivery
);

router.get(
  "/utils/recent-customers",
  checkRole(["admin", "owner"]),
  webPOController.getRecentCustomers
);

router.get(
  "/:id",
  checkRole(["admin", "owner"]),
  webPOController.getPurchaseOrderById
);
router.put(
  "/:id",
  checkRole(["admin", "owner"]),
  webPOController.updatePurchaseOrder
);
router.delete(
  "/:id",
  checkRole(["admin", "owner"]),
  webPOController.deletePurchaseOrder
);

// DO creation from PO
router.get(
  "/:id/do-details",
  checkRole(["admin", "owner"]),
  webPOController.getPoDetailsForNewDo
);
router.post(
  "/:id/create-delivery-order",
  checkRole(["admin", "owner"]),
  webPOController.createDeliveryOrderFromPO
);

module.exports = router;
