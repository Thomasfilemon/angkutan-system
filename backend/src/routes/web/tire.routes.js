// src/routes/web/tire.routes.js
const express = require('express');
const tireRouter = express.Router();
const tireController = require('../../controllers/web/tireController');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

tireRouter.use(verifyToken);

// Get all vehicles for tire management
tireRouter.get('/vehicles', checkRole(['admin', 'owner']), tireController.getVehiclesForTireManagement);

// Get tire status for specific vehicle
tireRouter.get('/vehicles/:vehicleId/status', checkRole(['admin', 'owner']), tireController.getVehicleTireStatus);

// Install new tire
tireRouter.post('/vehicles/:vehicleId/install', checkRole(['admin', 'owner']), tireController.installTire);

// Update tire data
tireRouter.post('/tire-inventory', checkRole(['admin', 'owner']), tireController.createTireInventory);
tireRouter.put('/tires/:tireId', checkRole(['admin', 'owner']), tireController.updateTireData);

// Remove tire
tireRouter.delete('/tires/:tireId', checkRole(['admin', 'owner']), tireController.removeTire);

// Get all tire inventory
tireRouter.get('/tire-inventory/all', checkRole(['admin', 'owner']), tireController.getAllTireInventory);

// Delete tire inventory
tireRouter.delete('/tire-inventory/:id', checkRole(['admin', 'owner']), tireController.deleteTireInventory);

tireRouter.get('/tire-inventory/:id', checkRole(['admin', 'owner']), tireController.getTireInventoryById);
tireRouter.get('/tire-inventory', checkRole(['admin', 'owner']), tireController.getTireInventory);
tireRouter.put('/tire-inventory/:id', checkRole(['admin', 'owner']), tireController.updateTireInventory);

// Get tire inspection history
tireRouter.get('/tires/:tireId/inspections', checkRole(['admin', 'owner']), tireController.getTireInspectionHistory);

tireRouter.post('/tire-instances', checkRole(['admin', 'owner']), tireController.createTireInstances);
tireRouter.get('/tire-instances/available', checkRole(['admin', 'owner']), tireController.getAvailableTireInstances);
tireRouter.post('/vehicles/:vehicleId/install-instance', checkRole(['admin', 'owner']), tireController.installTireInstance);
tireRouter.get('/tire-instances/:instanceId/history', checkRole(['admin', 'owner']), tireController.getTireInstanceHistory);
tireRouter.get('/tire-instances/removed', checkRole(['admin', 'owner']), tireController.getRemovedTireInstances);

module.exports = tireRouter;
