// src/routes/deliveryOrder.routes.js

const express = require("express");
const router = express.Router();
const doController = require("../controllers/deliveryOrder.controller");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // <-- 1. Import modul File System (fs)

// Tentukan direktori tujuan upload
const uploadDir = "uploads/surat_jalan";

// Setup multer yang lebih tangguh untuk surat jalan uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 2. Logika untuk membuat direktori secara otomatis
    // fs.mkdirSync akan membuat folder jika belum ada.
    // Opsi { recursive: true } memastikan ia juga membuat folder parent ('uploads').
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir); // Kirim direktori yang sudah pasti ada
  },
  filename: (req, file, cb) => {
    // Format nama file untuk menghindari konflik
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, "suratjalan-" + uniqueSuffix + fileExtension);
  },
});

// Tambahkan filter untuk hanya menerima tipe file gambar atau PDF
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Error: File upload only supports JPEG, JPG, PNG, atau PDF."));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batasi ukuran file 5MB
  fileFilter: fileFilter,
});

// All routes below are protected by the token verification middleware
router.use(verifyToken);

// === ADMIN-SPECIFIC ROUTES ===
router.post(
  "/",
  checkRole(["admin", "owner"]),
  upload.single("surat_jalan"), // Middleware upload diterapkan di sini
  doController.createDeliveryOrder
);

// === DRIVER-SPECIFIC ROUTES ===
router.get("/me", checkRole(["driver"]), doController.getMyDeliveryOrders);
router.patch(
  "/:id/start",
  checkRole(["driver"]),
  doController.startToDestination
);
router.patch(
  "/:id/arrive",
  checkRole(["driver"]),
  doController.arriveAtDestination
);
router.patch(
  "/:id/return",
  checkRole(["driver"]),
  doController.startReturnToBase
);
router.patch(
  "/:id/complete",
  checkRole(["driver"]),
  doController.completeDeliveryOrder
);

// === GENERAL & ADMIN ROUTES ===
router.get(
  "/",
  checkRole(["admin", "owner", "driver"]),
  doController.getAllDeliveryOrders
);
router.get(
  "/:id",
  checkRole(["admin", "owner", "driver"]),
  doController.getDeliveryOrderById
);

module.exports = router;
