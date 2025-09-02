const express = require("express");
const router = express.Router();
const analyticsController = require("../../controllers/web/analytics.controller");
const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Dashboard metrics route with role-based access
router.get(
  "/dashboard",
  checkRole(["admin", "owner"]),
  analyticsController.getDashboardMetrics
);

// Expense analytics route
router.get(
  "/expenses",
  checkRole(["admin", "owner"]),
  analyticsController.getExpenseAnalytics
);

module.exports = router;
