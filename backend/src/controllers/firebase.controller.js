const admin = require("../services/firebase");

exports.testAuth = async (req, res) => {
  try {
    const customToken = await admin.auth().createCustomToken("test-user");
    res.json({
      message: "Firebase Auth is working",
      testToken: customToken,
    });
  } catch (error) {
    res.status(500).json({
      error: "Firebase Auth error",
      details: error.message,
    });
  }
};

exports.protectedRoute = (req, res) => {
  res.json({
    message: `Hello, ${req.user.email}! This is a protected route`,
    user: req.user,
  });
};
