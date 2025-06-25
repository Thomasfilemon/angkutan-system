// src/routes/web/ritase.routes.js
const express = require("express");
const router = express.Router();
const ritaseController = require("../../controllers/web/ritase.controller");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// ✅ PO-focused Ritase Routes (NEW)
router.get(
  "/purchase-orders",
  checkRole(["admin", "owner"]),
  ritaseController.getPurchaseOrdersWithPaymentStatus
);

router.get(
  "/purchase-orders/:po_id",
  checkRole(["admin", "owner"]),
  ritaseController.getPurchaseOrderPaymentDetail
);

router.get(
  "/delivery-orders/:do_id/payment",
  checkRole(["admin", "owner"]),
  ritaseController.getDeliveryOrderPaymentDetail
);

router.post(
  "/delivery-orders/:do_id/confirm",
  checkRole(["admin", "owner"]),
  ritaseController.confirmDeliveryOrderForPayment
);

router.post(
  "/delivery-orders/:do_id/invoice",
  checkRole(["admin", "owner"]),
  ritaseController.createDeliveryOrderInvoice
);

router.post(
  "/delivery-orders/:do_id/payment",
  checkRole(["admin", "owner"]),
  ritaseController.recordDeliveryOrderPayment
);

router.post(
  "/delivery-orders/:do_id/adjustment",
  checkRole(["admin", "owner"]),
  ritaseController.createPriceAdjustment
);

// ✅ Existing Vehicle-focused Routes
router.get(
  "/",
  checkRole(["admin", "owner"]),
  ritaseController.getRitaseDashboard
);

router.get(
  "/vehicles/:vehicle_id",
  checkRole(["admin", "owner"]),
  ritaseController.getVehiclePerformance
);

router.post(
  "/payment-status",
  checkRole(["admin", "owner"]),
  ritaseController.updatePaymentStatus
);

router.get(
  "/export",
  checkRole(["admin", "owner"]),
  ritaseController.exportRitaseExcel
);

module.exports = router;

// GET /api/web/ritase/purchase-orders           // List PO with payment status
// GET /api/web/ritase/purchase-orders/:po_id    // PO detail + DO list
// GET /api/web/ritase/delivery-orders/:do_id/payment // DO payment management

// POST /api/web/ritase/delivery-orders/:do_id/confirm     // Confirm DO for payment
// POST /api/web/ritase/delivery-orders/:do_id/invoice     // Create invoice
// POST /api/web/ritase/delivery-orders/:do_id/payment     // Record payment
// POST /api/web/ritase/delivery-orders/:do_id/adjustment  // Price adjustment

// GET /api/web/ritase                           // Vehicle dashboard
// GET /api/web/ritase/vehicles/:vehicle_id      // Vehicle performance
// GET /api/web/ritase/export                    // Excel export
