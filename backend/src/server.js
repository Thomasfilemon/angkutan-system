// backend/src/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./utils/db");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Angkutan API is running!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Tes koneksi DB
app.get("/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error("DB Connection Error:", err);
    res.status(500).json({ error: "DB connection failed" });
  }
});

// Nanti: import routes di sini. Contoh:
// const authRoutes = require('./routes/auth.routes');
// app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
