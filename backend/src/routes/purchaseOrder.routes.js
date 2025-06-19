// src/routes/purchaseOrder.routes.js

const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrder.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(verifyToken);

// GET all purchase orders
router.get('/', checkRole(['admin', 'owner']), poController.getAllPurchaseOrders);

// GET active purchase orders (for creating DOs)
router.get('/active', checkRole(['admin', 'owner']), poController.getActivePurchaseOrders);

// GET single purchase order
router.get('/:id', checkRole(['admin', 'owner']), poController.getPurchaseOrderById);

// POST create new purchase order
router.post('/', checkRole(['admin', 'owner']), poController.createPurchaseOrder);

// PUT update purchase order
router.put('/:id', checkRole(['admin', 'owner']), poController.updatePurchaseOrder);

// DELETE purchase order
router.delete('/:id', checkRole(['admin', 'owner']), poController.deletePurchaseOrder);

module.exports = router;
