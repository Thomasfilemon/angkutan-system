// src/routes/deliveryOrder.routes.js

const express = require('express');
const router = express.Router();
const doController = require('../controllers/deliveryOrder.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// All routes below are protected by the token verification middleware
router.use(verifyToken);

// === DRIVER-SPECIFIC ROUTES ===

// GET /api/delivery-orders/me - For a driver to get ONLY their list of tasks
router.get('/me', checkRole(['driver']), doController.getMyDeliveryOrders);

// PATCH /api/delivery-orders/:id/start - Driver starts the trip
router.patch('/:id/start', checkRole(['driver']), doController.startToDestination);

// PATCH /api/delivery-orders/:id/arrive - Driver arrives at destination
router.patch('/:id/arrive', checkRole(['driver']), doController.arriveAtDestination);

// PATCH /api/delivery-orders/:id/return - Driver starts returning to base
router.patch('/:id/return', checkRole(['driver']), doController.startReturnToBase);

// PATCH /api/delivery-orders/:id/complete - Driver completes the entire order
router.patch('/:id/complete', checkRole(['driver']), doController.completeDeliveryOrder);


// === GENERAL & ADMIN ROUTES ===

// GET /api/delivery-orders - Get ALL delivery orders, with optional filtering
// This endpoint now handles the request from your Vehicle screen correctly.
router.get('/', checkRole(['admin', 'owner', 'driver']), doController.getAllDeliveryOrders);

// GET /api/delivery-orders/:id - Get a single delivery order by its ID
router.get('/:id', checkRole(['admin', 'owner', 'driver']), doController.getDeliveryOrderById);


module.exports = router;
