const db = require("../utils/db");

exports.healthCheck = (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
};

exports.dbTest = async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error("DB Connection Error:", err);
    res.status(500).json({ error: "DB connection failed" });
  }
};
