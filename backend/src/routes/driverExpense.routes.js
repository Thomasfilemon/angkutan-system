// src/routes/deliveryExpense.routes.js

const express = require("express");
const router = express.Router();
const driverExpenseController = require("../controllers/driverExpenseController");
const { verifyToken } = require("../middlewares/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // <-- Tambahkan import fs

// Tentukan direktori tujuan upload
const uploadDir = "uploads/receipts";

// Setup multer yang lebih tangguh untuk receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Buat direktori secara otomatis jika belum ada
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, "receipt-" + uniqueSuffix + fileExtension);
  },
});

// Filter file untuk hanya menerima gambar
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(
    new Error("Error: File upload hanya mendukung format JPEG, JPG, atau PNG.")
  );
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batasi ukuran 5MB
  fileFilter: fileFilter,
});

// --- Sisa kode routes tetap sama ---
router.use(verifyToken);
router.get("/", driverExpenseController.getExpenses);
router.post(
  "/",
  upload.single("receipt"),
  driverExpenseController.createExpense
);
router.get("/:id", driverExpenseController.getExpenseById);
router.delete("/:id", driverExpenseController.deleteExpense);

module.exports = router;
