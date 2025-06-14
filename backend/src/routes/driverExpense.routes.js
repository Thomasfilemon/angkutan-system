const express = require('express');
const router = express.Router();
const driverExpenseController = require('../controllers/driverExpenseController');
const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/receipts/'),
  filename: (req, file, cb) => cb(null, 'receipt-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', verifyToken, driverExpenseController.getExpenses);
router.post('/', verifyToken, upload.single('receipt'), driverExpenseController.createExpense);

module.exports = router;
