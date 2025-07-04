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

router.get(
  "/available-dos",
  checkRole(["admin", "owner"]),
  bigDOController.getAvailableDeliveryOrders
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
  "/:id/status",
  checkRole(["admin", "owner"]),
  bigDOController.updateBigDeliveryOrderStatus
);

router.patch(
  "/:id/cancel",
  checkRole(["admin", "owner"]),
  bigDOController.cancelBigDeliveryOrder
);

router.post(
  "/:id/tambahan",
  checkRole(["admin", "owner"]),
  bigDOController.addTambahanToBigDO
);

// ✅ TAMBAHAN MANAGEMENT ROUTES
router.put(
  "/:id/tambahan/:tambahanId",
  checkRole(["admin", "owner"]),
  bigDOController.updateTambahan
);

router.patch(
  "/:id/tambahan/:tambahanId/status",
  checkRole(["admin", "owner"]),
  bigDOController.updateTambahanStatus
);

router.delete(
  "/:id/tambahan/:tambahanId",
  checkRole(["admin", "owner"]),
  bigDOController.deleteTambahan
);

router.get(
  "/:id/tambahan/:tambahanId",
  checkRole(["admin", "owner"]),
  bigDOController.getTambahanById
);

module.exports = router;
