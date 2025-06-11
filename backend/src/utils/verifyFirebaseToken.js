const admin = require("../services/firebase");

module.exports = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: "Authorization header missing",
        details: "Please provide a Bearer token",
      });
    }

    // Check Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid token format",
        details: "Token must be provided in Bearer format",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({
        error: "Token missing",
        details: "Token not found in Authorization header",
      });
    }

    // Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || "user",
      emailVerified: decodedToken.email_verified,
    };

    next();
  } catch (error) {
    console.error("Firebase token verification failed:", {
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    return res.status(401).json({
      error: "Authentication failed",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Invalid or expired token",
    });
  }
};
