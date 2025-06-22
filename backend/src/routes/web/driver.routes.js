const express = require('express');
const router = express.Router();
const driverController = require('../../controllers/driver.controller');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

// Apply global authentication
router.use(verifyToken);

// Web-specific driver routes (same as mobile for now)
router.get('/', checkRole(['admin', 'owner']), driverController.getAllDrivers);
router.get('/:id', checkRole(['admin', 'owner']), driverController.getDriverById);
router.post('/', checkRole(['admin', 'owner']), driverController.createDriver);
router.put('/:id', checkRole(['admin', 'owner']), driverController.updateDriver);
router.delete('/:id', checkRole(['admin', 'owner']), driverController.deleteDriver);

module.exports = router;
