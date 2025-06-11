const jwt = require("jsonwebtoken");

exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        details: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      details: "Invalid token",
    });
  }
};

exports.requireOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({
      error: "Forbidden",
      details: "Only owner can perform this action",
    });
  }
  next();
};
