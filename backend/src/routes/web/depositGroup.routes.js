const express = require("express");
const router = express.Router();
const depositGroupController = require("../../controllers/web/depositGroup.controller");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// ✅ Main deposit group routes
router.post(
  "/",
  checkRole(["admin", "owner"]),
  depositGroupController.createGroup
);

router.get(
  "/",
  checkRole(["admin", "owner"]),
  depositGroupController.getAllGroups
);

router.get(
  "/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.getGroupDetails
);

router.put(
  "/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.updateGroup
);

router.delete(
  "/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.deleteGroup
);

// ✅ Group membership routes
router.post(
  "/members",
  checkRole(["admin", "owner"]),
  depositGroupController.addDOToGroup
);

router.put(
  "/members/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.updateMemberQuantity
);

router.delete(
  "/members/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.removeDOFromGroup
);

router.post(
  "/members/:memberId/pay-extra",
  checkRole(["admin", "owner"]),
  depositGroupController.payExtraCharge
);

// ✅ Purchase Order linking routes
router.post(
  "/link-po",
  checkRole(["admin", "owner"]),
  depositGroupController.linkPOToGroup
);

// ✅ Delivery Order management routes
router.post(
  "/delivery-orders/:do_id/adjust-price",
  checkRole(["admin", "owner"]),
  depositGroupController.adjustDOPrice
);

router.put(
  "/delivery-orders/:do_id/finalize-amount",
  checkRole(["admin", "owner"]),
  depositGroupController.finalizeDOAmount
);

// ✅ Invoice generation routes
router.post(
  "/:group_id/selisih-invoice",
  checkRole(["admin", "owner"]),
  depositGroupController.generateSelisihInvoice
);

module.exports = router;
