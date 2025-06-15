// src/routes/vehicle.routes.js

const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middlewares/auth.middleware');

// All routes are protected
router.use(verifyToken);

// --- RESTful Routes for Vehicles ---

// GET /api/vehicles -> Get all vehicles (with optional filters)
router.get('/', vehicleController.getAllVehicles);

// POST /api/vehicles -> Create a new vehicle
router.post('/', vehicleController.createVehicle);

// GET /api/vehicles/:id -> Get a single vehicle by ID
router.get('/:id', vehicleController.getVehicleById);

// PUT /api/vehicles/:id -> Update a vehicle
router.put('/:id', vehicleController.updateVehicle);

// DELETE /api/vehicles/:id -> Delete a vehicle
router.delete('/:id', vehicleController.deleteVehicle);

// --- Routes for Service History ---

// GET /api/vehicles/:vehicle_id/history -> Get service history for a specific vehicle
router.get('/:vehicle_id/history', vehicleController.getServiceHistory);

module.exports = router;
