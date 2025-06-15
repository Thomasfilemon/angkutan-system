// src/controllers/vehicleController.js

const { Vehicle, VehicleService, DeliveryOrder } = require('../models');

// --- CREATE ---
exports.createVehicle = async (req, res, next) => {
  try {
    const newVehicle = await Vehicle.create(req.body);
    res.status(201).json(newVehicle);
  } catch (err) {
    // Catches validation errors from the model
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    next(err);
  }
};

// --- READ (ALL with powerful filtering) ---
exports.getAllVehicles = async (req, res, next) => {
  try {
    const { status, maintenance_due, docs_expiring } = req.query;
    let vehicles;

    // Use the powerful custom methods from your model!
    if (status === 'available') {
      vehicles = await Vehicle.findAvailable();
    } else if (maintenance_due === 'true') {
      vehicles = await Vehicle.findMaintenanceDue();
    } else if (docs_expiring === 'true') {
      vehicles = await Vehicle.findDocumentExpiring();
    } else {
      // Default: find all vehicles
      vehicles = await Vehicle.findAll({ order: [['license_plate', 'ASC']] });
    }
    
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
};

// --- READ (Single by ID) ---
exports.getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id, {
      // Include associated data for a complete view
      include: [
        { model: VehicleService, as: 'serviceHistory', limit: 10, order: [['service_date', 'DESC']] },
        { model: DeliveryOrder, as: 'deliveryOrders', limit: 5, order: [['created_at', 'DESC']] }
      ]
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
};

// --- UPDATE ---
exports.updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const updatedVehicle = await vehicle.update(req.body);
    res.json(updatedVehicle);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    next(err);
  }
};

// --- DELETE ---
exports.deleteVehicle = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vehicle = await Vehicle.findByPk(id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        await vehicle.destroy();
        res.status(204).send(); // Success, no content
    } catch (err) {
        next(err);
    }
};


// --- Service History Specific Endpoint ---
exports.getServiceHistory = async (req, res, next) => {
  try {
    const { vehicle_id } = req.params; // Get ID from URL parameter
    const history = await VehicleService.findAll({
      where: { vehicle_id },
      order: [['service_date', 'DESC']],
    });
    res.json(history);
  } catch (err) {
    next(err);
  }
};
