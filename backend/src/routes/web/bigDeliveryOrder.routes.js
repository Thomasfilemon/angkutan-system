// src/routes/web/bigDeliveryOrder.routes.js
const express = require("express");
const router = express.Router();
const bigDOController = require("../../controllers/web/bigDeliveryOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// 🎯 BIG DO CRUD OPERATIONS
router.get(
  "/",
  checkRole(["admin", "owner"]),
  bigDOController.getAllBigDeliveryOrders
);

router.post(
  "/",
  checkRole(["admin", "owner"]),
  bigDOController.createBigDeliveryOrder
);

router.get(
  "/:id",
  checkRole(["admin", "owner"]),
  bigDOController.getBigDeliveryOrderById
);

router.patch(
  "/:id/cancel",
  checkRole(["admin", "owner"]),
  bigDOController.cancelBigDeliveryOrder
);

module.exports = router;
