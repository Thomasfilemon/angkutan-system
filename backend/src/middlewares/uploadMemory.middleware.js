const multer = require("multer");

// Use memory storage so uploaded files are available as buffer in req.files
const storage = multer.memoryStorage();

const uploadMemory = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"), false);
    }
    cb(null, true);
  },
});

module.exports = uploadMemory;
