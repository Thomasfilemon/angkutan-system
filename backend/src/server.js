// server.js
require("dotenv").config();

const admin = require("./services/firebase");

const express = require("express");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const { sequelize } = require("./models");
const path = require("path");

// === Import Existing Routes (MOBILE) ===
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const purchaseOrderRoutes = require("./routes/purchaseOrder.routes");
const deliveryOrderRoutes = require("./routes/deliveryOrder.routes");
const userRoutes = require("./routes/user.routes");
const driverExpenseRoutes = require("./routes/driverExpense.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const driverRoutes = require("./routes/driver.routes");

// === Import Web Routes (NEW) ===
const webPurchaseOrderRoutes = require("./routes/web/purchaseOrder.routes");
const webDeliveryOrderRoutes = require("./routes/web/deliveryOrder.routes");
const webVehicleRoutes = require("./routes/web/vehicle.routes");
const webDriverRoutes = require("./routes/web/driver.routes");
const webStockRoutes = require("./routes/web/stock.routes");
const webServiceRoutes = require("./routes/web/service.routes");
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:8081',
];

// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl)
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     } else {
//       return callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true
// }));

app.use(cors({
  origin: "*", // <-- Allow all origins for debugging
  credentials: true
}));

// Setup middleware (cors, json)
setupMiddleware(app);

// Test database connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Database connection established successfully."))
  .catch((err) => console.error("❌ Unable to connect to the database:", err));

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Angkutan API (Sequelize) is running!",
    endpoints: {
      mobile: {
        purchase_orders: "/api/purchase-orders",
        delivery_orders: "/api/delivery-orders",
        vehicles: "/api/vehicles",
      },
      web: {
        purchase_orders: "/api/web/purchase-orders",
        delivery_orders: "/api/web/delivery-orders",
        vehicles: "/api/web/vehicles",
        stock: "/api/web/stock",
        services: "/api/web/services",
      },
    },
  });
});

// === Existing Mobile Routes (UNCHANGED) ===
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/delivery-orders", deliveryOrderRoutes);
app.use("/api/driver-expenses", driverExpenseRoutes);
app.use("/api/drivers", driverRoutes);
// app.use(
//   "/uploads",
//   (req, res, next) => {
//     res.setHeader("ngrok-skip-browser-warning", "true");
//     next();
//   },
//   express.static(path.join(__dirname, "../uploads"))
// );
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// === New Web Routes (ADDED) ===
app.use("/api/web/purchase-orders", webPurchaseOrderRoutes);
app.use("/api/web/delivery-orders", webDeliveryOrderRoutes);
app.use("/api/web/vehicles", webVehicleRoutes);
app.use("/api/web/drivers", webDriverRoutes);
app.use("/api/web/stock", webStockRoutes);
app.use("/api/web/services", webServiceRoutes);

// Error handling middleware
app.use(errorHandler);

// Start HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(
    `📱 Mobile API: /api/purchase-orders, /api/delivery-orders, /api/vehicles`
  );
  console.log(
    `🌐 Web API: /api/web/purchase-orders, /api/web/delivery-orders, /api/web/vehicles, /api/web/stock, /api/web/services`
  );
});
