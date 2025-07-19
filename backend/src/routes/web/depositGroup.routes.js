const express = require("express");
const router = express.Router();
const depositGroupController = require("../../controllers/web/depositGroup.controller");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

router.use(verifyToken);

// Deposit group routes
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

// Group membership routes
router.post(
  "/members",
  checkRole(["admin", "owner"]),
  depositGroupController.addDOToGroup
);
router.delete(
  "/members/:id",
  checkRole(["admin", "owner"]),
  depositGroupController.removeDOFromGroup
);

// Adjust delivery order price route
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

router.put("/members/:doId", checkRole(["admin", "owner"]), depositGroupController.updateMemberQuantity);

module.exports = router;