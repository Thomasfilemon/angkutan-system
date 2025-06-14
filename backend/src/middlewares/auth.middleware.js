const jwt = require('jsonwebtoken');
const { User } = require('../models');

// This function is correct.
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Authentication failed. User not found.' });
    }

    req.user = user; // Attach user to the request
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// A "factory" function to create role-checking middleware. This is best practice.
const checkRole = (roles) => {
  return (req, res, next) => {
    // This middleware must run AFTER verifyToken, so req.user will exist.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: You do not have the required permissions." });
    }
    next();
  };
};

// --- THIS IS THE FIX ---
// Create the specific 'requireOwner' middleware using the factory.
const requireOwner = checkRole(['owner']);

// Export all the functions you need in other files.
module.exports = {
  verifyToken,
  requireOwner, // <-- This line ensures it's no longer undefined
  checkRole,    // Good practice to export the factory too
};
