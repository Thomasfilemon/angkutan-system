const express = require("express");
const setupMiddleware = require("./middlewares/setup.middleware");
const errorHandler = require("./middlewares/error.middleware");
const healthRoutes = require("./routes/health.routes");
const firebaseRoutes = require("./routes/firebase.routes");
const authRoutes = require("./routes/auth.routes");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// Setup middleware
setupMiddleware(app);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Angkutan API is running!" });
});

// Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", firebaseRoutes);

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
