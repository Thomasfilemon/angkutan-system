// src/routes/web/ritase.routes.js
const express = require("express");
const router = express.Router();
const ritaseController = require("../../controllers/web/ritase.controller");
const paymentsCtrl = require("../../controllers/web/payments.controller");
const ritaseAnalyticsController = require("../../controllers/web/ritaseAnalytics.controller");
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

router.patch(
  "/delivery-orders/:doId/confirm",
  checkRole(["admin", "owner"]),
  paymentsCtrl.confirmDeliveryOrder
);

router.post(
  "/delivery-orders/:doId/invoices",
  checkRole(["admin", "owner"]),
  paymentsCtrl.createInvoice
);

router.post(
  "/delivery-orders/:doId/payment",
  checkRole(["admin", "owner"]),
  paymentsCtrl.recordPayment
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

router.patch(
  "/status",
  checkRole(["admin", "owner"]),
  paymentsCtrl.updatePaymentStatus
);

router.get(
  "/export",
  checkRole(["admin", "owner"]),
  ritaseController.exportRitaseExcel
);

// Table Analytics Routes
// 🎯 COMPREHENSIVE RITASE ANALYTICS ROUTES
router.get(
  "/comprehensive",
  checkRole(["admin", "owner"]),
  ritaseAnalyticsController.getComprehensiveRitaseTable
);

router.get(
  "/dashboard-metrics",
  checkRole(["admin", "owner"]),
  ritaseAnalyticsController.getDashboardMetrics
);

router.get(
  "/analytics/vehicles",
  checkRole(["admin", "owner"]),
  ritaseAnalyticsController.getVehicleAnalytics
);

router.get(
  "/export/comprehensive",
  checkRole(["admin", "owner"]),
  ritaseAnalyticsController.exportComprehensiveExcel
);

router.get(
  "/purchase-orders/:po_id/comprehensive",
  checkRole(["admin", "owner"]),
  ritaseAnalyticsController.getPOComprehensiveData
);

module.exports = router;
