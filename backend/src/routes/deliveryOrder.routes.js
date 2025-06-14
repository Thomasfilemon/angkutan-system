const express = require('express');
const router = express.Router();
const doController = require('../controllers/deliveryOrder.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Route for drivers to see their own tasks
router.get('/me', checkRole(['driver']), doController.getMyDeliveryOrders);

// Routes for drivers to update their task status
router.patch('/:id/start', checkRole(['driver']), doController.startToDestination);
router.patch('/:id/arrive', checkRole(['driver']), doController.arriveAtDestination);
// Add a 'return' route similar to the above
router.patch('/:id/complete', checkRole(['driver']), doController.completeDeliveryOrder);

// You can add admin routes here too if needed, e.g., to get ALL delivery orders
// router.get('/', checkRole(['admin', 'owner']), doController.getAllDeliveryOrders);

module.exports = router;
