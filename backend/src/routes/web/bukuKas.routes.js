// src/routes/web/bukuKas.routes.js
const express = require("express");
const router = express.Router();
const bukuKasController = require("../../controllers/web/bukuKas.controller");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// Buku kas dashboard routes
router.get(
  "/",
  checkRole(["admin", "owner"]),
  bukuKasController.getBukuKasDashboard
);

router.get(
  "/cash-flow",
  checkRole(["admin", "owner"]),
  bukuKasController.getCashFlowAnalysis
);

router.post(
  "/expense",
  checkRole(["admin", "owner"]),
  bukuKasController.addCompanyExpense
);

router.post(
  "/payment",
  checkRole(["admin", "owner"]),
  bukuKasController.recordPaymentTransaction
);

module.exports = router;
