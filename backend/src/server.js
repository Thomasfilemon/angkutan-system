require("dotenv").config();

const admin = require("./services/firebase");

const express = require("express");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const { sequelize } = require("./models"); // <-- Import from the new models/index.js

// === Import New Routes ===
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const purchaseOrderRoutes = require("./routes/purchaseOrder.routes"); // <-- NEW
const deliveryOrderRoutes = require("./routes/deliveryOrder.routes"); // <-- NEW
const userRoutes = require("./routes/user.routes");
const driverExpenseRoutes = require("./routes/driverExpense.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const driverRoutes = require("./routes/driver.routes");

// ... other routes

const app = express();
const PORT = process.env.PORT || 5000;

// Setup middleware (cors, json)
setupMiddleware(app);

// Test database connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Database connection established successfully."))
  .catch((err) => console.error("❌ Unable to connect to the database:", err));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Angkutan API v2 (Sequelize) is running!" });
});

// === Use New Routes ===
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes); // <-- USE NEW
app.use("/api/delivery-orders", deliveryOrderRoutes); // <-- USE NEW
app.use("/api/driver-expenses", driverExpenseRoutes);
app.use("/api/drivers", driverRoutes);

// Error handling middleware
app.use(errorHandler);

// Start HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
