const express = require("express");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const tripRoutes = require('./routes/trip.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const driverExpenseRoutes = require('./routes/driverExpense.routes');

const { sequelize } = require('./models');

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
setupMiddleware(app);

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Angkutan API is running!" });
});

// Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/driver-expenses', driverExpenseRoutes);

// Error handling middleware
app.use(errorHandler);

// Start HTTP server (ngrok will handle HTTPS)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Local access: http://localhost:${PORT}`);
  console.log(`📱 Start ngrok with: ngrok http ${PORT}`);
});
