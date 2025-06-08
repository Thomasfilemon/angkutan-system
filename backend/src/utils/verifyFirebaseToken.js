// backend/src/utils/verifyFirebaseToken.js
const admin = require("../services/firebase");

module.exports = async (req, res, next) => {
  // Expect header: Authorization: Bearer <Firebase ID Token>
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = { uid: decodedToken.uid, email: decodedToken.email };
    next();
  } catch (err) {
    console.error("Firebase token verification failed:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};
