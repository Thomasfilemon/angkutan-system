const express = require("express");
const router = express.Router();

// Pull the new payments controller
const PaymentsCtrl = require("../../controllers/web/payments.controller");

// LEGACY: /api/web/ritase/delivery-orders/:doId/invoices  →  createInvoice
router.post("/delivery-orders/:doId/invoices", (req, res, next) =>
  PaymentsCtrl.createInvoice(req, res, next)
);

// LEGACY: /api/web/ritase/invoices/:invoiceId              →  updateInvoice
router.put("/invoices/:invoiceId", (req, res, next) =>
  PaymentsCtrl.updateInvoice(req, res, next)
);

// LEGACY: /api/web/ritase/delivery-orders/:doId/payments   →  recordPayment
router.post("/delivery-orders/:doId/payments", (req, res, next) =>
  PaymentsCtrl.recordPayment(req, res, next)
);

// LEGACY: /api/web/ritase/payments/status                  →  updatePaymentStatus
router.patch("/payments/status", (req, res, next) =>
  PaymentsCtrl.updatePaymentStatus(req, res, next)
);

// LEGACY: /api/web/ritase/delivery-orders/:doId/confirm    →  confirmDeliveryOrder
router.patch("/delivery-orders/:doId/confirm", (req, res, next) =>
  PaymentsCtrl.confirmDeliveryOrder(req, res, next)
);

module.exports = router;
