// Update src/routes/web/deliveryOrder.routes.js
const express = require('express');
const router = express.Router();
const webDOController = require('../../controllers/web/deliveryOrderController');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', checkRole(['admin', 'owner']), webDOController.getAllDeliveryOrders);
router.get('/statistics', checkRole(['admin', 'owner']), webDOController.getDeliveryStatistics);
router.post('/', checkRole(['admin', 'owner']), webDOController.createDeliveryOrder); // ADD THIS
router.get('/:id', checkRole(['admin', 'owner']), webDOController.getDeliveryOrderById);
router.put('/:id', checkRole(['admin', 'owner']), webDOController.updateDeliveryOrder);
router.patch('/:id/cancel', checkRole(['admin', 'owner']), webDOController.cancelDeliveryOrder);

module.exports = router;
