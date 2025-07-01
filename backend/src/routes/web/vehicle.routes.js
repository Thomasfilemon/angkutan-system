// src/routes/web/vehicle.routes.js
const express = require('express');
const vehicleRouter = express.Router();
const vehicleController = require('../../controllers/web/webvehicleController');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

vehicleRouter.use(verifyToken);

// --- Static and Collection Routes ---
// Routes that don't depend on a specific vehicle ID
vehicleRouter.get('/statistics', checkRole(['admin', 'owner']), vehicleController.getVehicleStatistics);
vehicleRouter.get('/drivers/available', checkRole(['admin', 'owner']), vehicleController.getAvailableDrivers);
vehicleRouter.get('/', checkRole(['admin', 'owner']), vehicleController.getAllVehicles);
vehicleRouter.post('/', checkRole(['admin', 'owner']), vehicleController.createVehicle);


// --- Parameterized Routes for a Single Vehicle ---
// All routes operating on a specific vehicle should use the same ':id' parameter for consistency.
vehicleRouter.get('/:id', checkRole(['admin', 'owner']), vehicleController.getVehicleById);
vehicleRouter.put('/:id', checkRole(['admin', 'owner']), vehicleController.updateVehicle);
vehicleRouter.delete('/:id', checkRole(['admin', 'owner']), vehicleController.deleteVehicle);

// FIX: Standardized on PATCH and the ':id' parameter for assigning a driver.
vehicleRouter.patch('/:id/assign-driver', checkRole(['admin', 'owner']), vehicleController.assignDriver);

// FIX: Standardized nested resource routes to also use ':id'.
vehicleRouter.get('/:id/history', checkRole(['admin', 'owner']), vehicleController.getServiceHistory);
// vehicleRouter.get('/:id/services', checkRole(['admin', 'owner']), vehicleController.getVehicleServices);


module.exports = vehicleRouter;