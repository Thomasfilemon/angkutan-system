var admin = require("firebase-admin");

var serviceAccount = require("../angkutan-system-firebase-adminsdk-fbsvc-35bb803ee3.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
