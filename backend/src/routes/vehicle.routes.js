// src/routes/web/vehicle.routes.js
const express = require('express');
const vehicleRouter = express.Router(); // Changed from 'router' to avoid conflicts
const vehicleController = require('../controllers/vehicleController');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

vehicleRouter.use(verifyToken);

// CRITICAL: ALL specific routes MUST come before ANY parameterized routes
// Static routes (no parameters)
vehicleRouter.get('/statistics', checkRole(['admin', 'owner', 'driver']), vehicleController.getVehicleStatistics);
vehicleRouter.get('/drivers/available', checkRole(['admin', 'owner', 'driver']), vehicleController.getAvailableDrivers);

// Collection routes (operate on the collection, not individual items)
vehicleRouter.get('/', checkRole(['admin', 'owner', 'driver']), vehicleController.getAllVehicles);
vehicleRouter.post('/', checkRole(['admin', 'owner', 'driver']), vehicleController.createVehicle);

// IMPORTANT: All parameterized routes MUST come after static routes
// Individual resource routes (operate on specific items by ID)
vehicleRouter.get('/:id', checkRole(['admin', 'owner', 'driver']), vehicleController.getVehicleById);
vehicleRouter.put('/:id', checkRole(['admin', 'owner', 'driver']), vehicleController.updateVehicle);
vehicleRouter.delete('/:id', checkRole(['admin', 'owner', 'driver']), vehicleController.deleteVehicle);

// Nested resource routes (specific actions on individual items)
vehicleRouter.get('/:vehicle_id/history', checkRole(['admin', 'owner', 'driver']), vehicleController.getServiceHistory);
vehicleRouter.put('/:vehicleId/assign-driver', checkRole(['admin', 'owner', 'driver']), vehicleController.assignDriver);

module.exports = vehicleRouter;