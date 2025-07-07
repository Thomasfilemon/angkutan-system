// backend/src/middlewares/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the upload directory
const uploadDir = 'uploads/receipts/';

// Ensure the upload directory exists, create it if it doesn't
fs.mkdirSync(uploadDir, { recursive: true });

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename to avoid overwrites
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Initialize multer with the storage configuration
const upload = multer({
  storage: storage,
  limits: { fileSize: 2000000 }, // Set a file size limit (e.g., 2MB)
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

// Function to check if the uploaded file is an image
function checkFileType(file, cb) {
  // Allowed extensions
  const filetypes = /jpeg|jpg|png|gif/;
  // Check the extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check the mime type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Only images (jpeg, jpg, png, gif) are allowed!'));
  }
}

module.exports = upload;
