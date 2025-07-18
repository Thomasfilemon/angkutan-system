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

module.exports = router;