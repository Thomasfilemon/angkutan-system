// src/routes/web/deliveryOrder.routes.js
const express = require("express");
const router = express.Router();
const webDOController = require("../../controllers/web/deliveryOrderController");
const bigDOController = require("../../controllers/web/bigDeliveryOrderController");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

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
router.post(
  "/",
  checkRole(["admin", "owner"]),
  webDOController.createDeliveryOrder
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

// Initialize Big DO creation session
router.post(
  "/initialize-big-do",
  checkRole(["admin", "owner"]),
  bigDOController.initializeBigDOSession
);

// Get Big DO session data
router.get(
  "/big-do-session/:sessionId",
  checkRole(["admin", "owner"]),
  bigDOController.getBigDOSession
);

// Cancel Big DO session
router.delete(
  "/big-do-session/:sessionId",
  checkRole(["admin", "owner"]),
  bigDOController.cancelBigDOSession
);

// Update DO display order in session
router.patch(
  "/big-do-session/:session_id/reorder",
  checkRole(["admin", "owner"]),
  webDOController.updateDODisplayOrder
);

// Finalize Big DO (create Big DO from session)
router.post(
  "/finalize-big-do",
  checkRole(["admin", "owner"]),
  bigDOController.createBigDeliveryOrder
);

module.exports = router;
