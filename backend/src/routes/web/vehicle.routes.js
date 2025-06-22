// src/routes/web/vehicle.routes.js
const express = require('express');
const router = express.Router();
const vehicleController = require('../../controllers/web/vehicleController');
const driverController = require('../../controllers/driver.controller');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

router.use(verifyToken);

// CRITICAL: Specific routes MUST come before parameterized routes
router.get('/drivers/available', checkRole(['admin', 'owner']), driverController.getAvailableDrivers);
router.get('/statistics', checkRole(['admin', 'owner']), vehicleController.getVehicleStatistics);
router.get('/', checkRole(['admin', 'owner']), vehicleController.getAllVehicles);

// Parameterized routes come AFTER specific routes
router.get('/:id', checkRole(['admin', 'owner']), vehicleController.getVehicleById);
router.post('/', checkRole(['admin', 'owner']), vehicleController.createVehicle);
router.put('/:id', checkRole(['admin', 'owner']), vehicleController.updateVehicle);
router.delete('/:id', checkRole(['admin', 'owner']), vehicleController.deleteVehicle);
router.put('/:vehicleId/assign-driver', checkRole(['admin', 'owner']), vehicleController.assignDriver);

module.exports = router;
