const jwt = require("jsonwebtoken");
const { User, DriverProfile } = require("../models");

// === IMPROVED verifyToken MIDDLEWARE ===
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Access token is required",
      });
    }

    const token = authHeader.split(" ")[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({
        message: "Invalid token format",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    // Fetch complete user data with profile
    const user = await User.findByPk(decoded.id, {
      include: [
        {
          model: DriverProfile,
          as: "driverProfile",
          required: false,
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    // === PASTIKAN req.user COMPLETE ===
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role, // <-- PASTIKAN FIELD INI ADA
      driverProfile: user.driverProfile,
    };

    console.log("Authenticated user:", req.user);
    next();
  } catch (error) {
    console.error("Token verification error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    return res.status(500).json({
      message: "Token verification failed",
    });
  }
};

// === IMPROVED checkRole MIDDLEWARE ===
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Debug logging
      console.log("checkRole middleware - req.user:", req.user);
      console.log("checkRole middleware - allowedRoles:", allowedRoles);

      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }

      if (!req.user.role) {
        console.error("req.user.role is undefined:", req.user);
        return res.status(500).json({
          message: "User role is not defined",
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: "Not authorized to access this resource",
          requiredRoles: allowedRoles,
          role: req.user.role,
          code: "ROLE_FORBIDDEN",
        });
      }

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return res.status(500).json({
        message: "Role verification failed",
      });
    }
  };
};

module.exports = { verifyToken, checkRole };
