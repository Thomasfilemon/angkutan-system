// backend/src/routes/web/cash.routes.js
const express = require('express');
const router = express.Router();
const cashController = require('../../controllers/web/cashController');
const { verifyToken } = require('../../middlewares/auth.middleware'); // CHANGE: Use destructuring
const upload = require('../../middlewares/upload.middleware'); // Import the upload middleware

// Apply auth middleware to all routes
router.use(verifyToken); // CHANGE: Use verifyToken instead of authMiddleware

// Cash categories route MUST come BEFORE the /:id route
router.get('/categories', cashController.getCashCategories);

// Cash transactions routes
router.get('/transactions', cashController.getAllCashTransactions);
router.get('/tempo-transactions', cashController.getAllTempoTransactions);
// router.post('/transactions', upload.single('attachment'), cashController.createCashTransaction);
router.get('/transactions/:id', cashController.getCashTransactionById);
// router.put('/transactions/:id', cashController.updateCashTransaction);
router.delete('/transactions/:id', cashController.deleteCashTransaction);

router.post(
  '/transactions', 
  upload.array('attachments', 5), // Matches frontend field name
  cashController.createCashTransaction
);
router.put('/transactions/:id', upload.array('attachments', 5), cashController.updateCashTransaction);

module.exports = router;
