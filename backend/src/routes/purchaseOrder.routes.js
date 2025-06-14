const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrder.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// All PO routes are protected and for admins/owners only
router.use(verifyToken, checkRole(['admin', 'owner']));

router.get('/', poController.getAllPurchaseOrders);
router.get('/:id', poController.getPurchaseOrderById);

module.exports = router;
