/**
 * Payment-related routes
 * Prefix mounted in app.js as:  app.use('/api/web/payments', paymentsRouter);
 */

const express = require("express");
const router = express.Router();

const PaymentsCtrl = require("../../controllers/web/payments.controller");

const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");
router.use(verifyToken);

router.get(
  "/overview",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.getOverviewStats
);

router.get(
  "/delivery-orders",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.getDeliveryOrders
);

// GET /purchase-orders/:poId/billing-summary
// Now returns full potential vs actual breakdown
// router.get(
//   "/purchase-orders/:poId/billing-summary",
//   checkRole(["admin", "owner"]),
//   PaymentsCtrl.getPOBillingSummary
// );

// ──────── Invoice Endpoints ────────

// Create single-DO invoice
// POST /api/web/payments/delivery-orders/:doId/invoices
router.post(
  "/delivery-orders/:doId/invoices",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.createInvoice
);

// GET /api/web/payments/delivery-orders/:doId/invoices/:invoiceId
router.get(
  "/delivery-orders/:doId/invoices/:invoiceId",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.getInvoiceDetail
);

// Update invoice (edit PPH %, amount, due date, notes, status)
// PUT /api/web/payments/invoices/:invoiceId
router.put(
  "/invoices/:invoiceId",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.updateInvoice
);

// Invoice management
router.get(
  "/invoices",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.getInvoices
);
router.patch(
  "/invoices/:invoiceId/status",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.updateInvoiceStatus
);
router.post(
  "/bulk-invoices",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.createBulkInvoice
);
router.get(
  "/delivery-orders/bulk-eligible",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.getBulkEligibleDOs
);
router.get(
  "/invoices/export",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.exportInvoices
);

// ──────── Payment Endpoints ────────

// Record payment for a Delivery Order (and optionally an invoice)
// POST /api/web/payments/delivery-orders/:doId
router.post(
  "/delivery-orders/:doId",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.recordPayment
);

// Manual payment-status override (deposit, lunas, etc.)
// PATCH /api/web/payments/status
router.patch(
  "/status",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.updatePaymentStatus
);

// Confirm completed DO as ready for invoicing / payment
// PATCH /api/web/payments/delivery-orders/:doId/confirm
router.patch(
  "/delivery-orders/:doId/confirm",
  checkRole(["admin", "owner"]),
  PaymentsCtrl.confirmDeliveryOrder
);

module.exports = router;
