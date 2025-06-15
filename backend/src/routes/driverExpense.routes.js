// src/routes/driverExpense.routes.js

const express = require('express');
const router = express.Router();
const driverExpenseController = require('../controllers/driverExpenseController');
const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');

// Set up multer for file uploads [3]
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/receipts/'),
  filename: (req, file, cb) => cb(null, 'receipt-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- All routes below this are protected by the token middleware ---
router.use(verifyToken);

// --- Define RESTful routes [4] ---

// GET /api/driver-expenses -> Get all expenses for the logged-in driver
router.get('/', driverExpenseController.getExpenses);

// POST /api/driver-expenses -> Create a new expense
router.post('/', upload.single('receipt'), driverExpenseController.createExpense);

// --- ADD THESE NEW ROUTES FOR DETAIL VIEW AND DELETION ---

// GET /api/driver-expenses/:id -> Get a single expense by its ID
router.get('/:id', driverExpenseController.getExpenseById);

// DELETE /api/driver-expenses/:id -> Delete an expense
router.delete('/:id', driverExpenseController.deleteExpense);

// You can add an update route here in the future if needed:
// router.put('/:id', upload.single('receipt'), driverExpenseController.updateExpense);

module.exports = router;
