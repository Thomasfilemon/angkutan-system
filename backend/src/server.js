const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const tripRoutes = require('./routes/trip.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const driverExpenseRoutes = require('./routes/driverExpense.routes');

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
setupMiddleware(app);

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

// HTTPS configuration
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../certs', 'cert.pem'))
};

// Start HTTPS server
https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTPS Server running on https://0.0.0.0:${PORT}`);
  console.log(`🌐 Network access: https://192.168.1.7:${PORT}`);
  console.log(`🔒 SSL certificates loaded successfully`);
});

// Also start HTTP server for mobile development (optional)
if (process.env.NODE_ENV === 'development') {
  const HTTP_PORT = 3001;
  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`📱 HTTP Server for mobile dev: http://192.168.1.7:${HTTP_PORT}`);
  });
}
