// src/routes/web/tire.routes.js
const express = require('express');
const tireRouter = express.Router();
const tireController = require('../../controllers/web/tireController');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware'); // 👈 Import the middleware

tireRouter.use(verifyToken, checkRole(['admin', 'owner']));

// --- Vehicle & Tire Status ---
tireRouter.get('/vehicles', tireController.getVehiclesForTireManagement);
tireRouter.get('/vehicles/:vehicleId/status', tireController.getVehicleTireStatus);

// --- Tire Installation / Removal ---
// REMOVED: Old install route is deprecated. Use install-instance instead.
// tireRouter.post('/vehicles/:vehicleId/install', tireController.installTire); 
tireRouter.post('/vehicles/:vehicleId/install-instance', tireController.installTireInstance);
tireRouter.delete('/tires/:tireId', tireController.removeTire); // tireId here is vehicle_tires.id

// --- Tire Data & Inspection ---
tireRouter.put('/tires/:tireId', tireController.updateTireData); // tireId here is vehicle_tires.id
tireRouter.get('/tires/:tireId/inspections', tireController.getTireInspectionHistory);

// --- Tire Inventory Management (Brands/Types) ---
tireRouter.post('/tire-inventory', tireController.createTireInventory);
tireRouter.get('/tire-inventory/all', tireController.getAllTireInventory);
tireRouter.get('/tire-inventory/:id', tireController.getTireInventoryById);
tireRouter.put('/tire-inventory/:id', tireController.updateTireInventory);
tireRouter.delete('/tire-inventory/:id', tireController.deleteTireInventory);
tireRouter.get('/tire-inventory', tireController.getTireInventory); // Get inventory with stock > 0

// --- Tire Instance Management (Individual Tires) ---
tireRouter.get('/inventory-instances', tireController.getInventoryTireInstances);
tireRouter.post('/tire-instances', tireController.createTireInstances);
tireRouter.get('/tire-instances/available', tireController.getAvailableTireInstances);
tireRouter.get('/tire-instances/removed', tireController.getRemovedTireInstances);
tireRouter.get('/tire-instances/:instanceId/history', tireController.getTireInstanceHistory);

module.exports = tireRouter;