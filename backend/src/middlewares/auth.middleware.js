const jwt = require("jsonwebtoken");
const db = require("../utils/db");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await db.query(
      "SELECT id, username, role FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

module.exports = { authenticateToken };
