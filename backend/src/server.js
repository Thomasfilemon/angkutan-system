// server.js
require("dotenv").config();

const admin = require("./services/firebase");

const express = require("express");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const { sequelize } = require("./models");
const path = require("path");
const cors = require("cors");

// === Import Existing Routes (MOBILE) ===
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const purchaseOrderRoutes = require("./routes/purchaseOrder.routes");
const deliveryOrderRoutes = require("./routes/deliveryOrder.routes");
const bigDeliveryOrderRoutes = require("./routes/bigDeliveryOrder.routes");
const userRoutes = require("./routes/user.routes");
const driverExpenseRoutes = require("./routes/driverExpense.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const driverRoutes = require("./routes/driver.routes");

// === Import Web Routes (NEW) ===
const webPurchaseOrderRoutes = require("./routes/web/purchaseOrder.routes");
const webDeliveryOrderRoutes = require("./routes/web/deliveryOrder.routes");
const webBigDeliveryOrderRoutes = require("./routes/web/bigDeliveryOrder.routes");
const webVehicleRoutes = require("./routes/web/vehicle.routes");
const webDriverRoutes = require("./routes/web/driver.routes");
const webStockRoutes = require("./routes/web/stock.routes");
const webServiceRoutes = require("./routes/web/service.routes");
const webTireRoutes = require("./routes/web/tire.routes");
const webCashRoutes = require("./routes/web/cash.routes");
const webRitaseRoutes = require("./routes/web/ritase.routes");
const webBukuKasRoutes = require("./routes/web/bukuKas.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: Allow all origins for debugging
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// Setup middleware (cors, json, etc)
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
        big_delivery_orders: "/api/web/big-delivery-orders",
        vehicles: "/api/web/vehicles",
        stock: "/api/web/stock",
        services: "/api/web/services",
        tires: "/api/web/tires",
        cash: "/api/web/cash",
        ritase: "/api/web/ritase",
        buku_kas: "/api/web/buku-kas",
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
app.use("/api/big-delivery-orders", bigDeliveryOrderRoutes);
app.use("/api/driver-expenses", driverExpenseRoutes);
app.use("/api/drivers", driverRoutes);

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// === New Web Routes (ADDED) ===
app.use("/api/web/purchase-orders", webPurchaseOrderRoutes);
app.use("/api/web/delivery-orders", webDeliveryOrderRoutes);
app.use("/api/web/vehicles", webVehicleRoutes);
app.use("/api/web/drivers", webDriverRoutes);
app.use("/api/web/stock", webStockRoutes);
app.use("/api/web/services", webServiceRoutes);
app.use("/api/web/tires", webTireRoutes);
app.use("/api/web/cash", webCashRoutes);
app.use("/api/web/ritase", webRitaseRoutes);
app.use("/api/web/buku-kas", webBukuKasRoutes);

// Error handling middleware
app.use(errorHandler);

// Start HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(
    `📱 Mobile API: /api/purchase-orders, /api/delivery-orders, /api/vehicles`
  );
  console.log(
    `🌐 Web API: /api/web/purchase-orders, /api/web/delivery-orders, /api/web/vehicles, /api/web/stock, /api/web/services, /api/web/tires`
  );
});
