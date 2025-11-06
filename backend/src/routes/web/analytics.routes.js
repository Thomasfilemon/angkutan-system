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

// Vehicle expenditure analytics route
router.get(
  "/vehicles/expenditure",
  checkRole(["admin", "owner"]),
  analyticsController.getVehicleExpenditureAnalytics
);

// Test route to verify analytics endpoint is working
router.get(
  "/test",
  checkRole(["admin", "owner"]),
  (req, res) => {
    res.json({
      success: true,
      message: "Analytics endpoint is working",
      timestamp: new Date().toISOString()
    });
  }
);

module.exports = router;
