// src/controllers/vehicleController.js
const { Vehicle, User } = require('../models');
const { Op } = require('sequelize');

// Get all vehicles with driver information
exports.getAllVehicles = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { license_plate: { [Op.iLike]: `%${search}%` } },
        { type: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const result = await Vehicle.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'username'],
          include: [
            {
              model: require('../models').DriverProfile,
              as: 'driverProfile',
              attributes: ['full_name', 'phone', 'status'],
              required: false
            }
          ],
          required: false
        }
      ],
      order: [['license_plate', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Enhanced vehicle data with driver information
    const enhancedVehicles = result.rows.map(vehicle => {
      const vehicleData = vehicle.toJSON();
      return {
        ...vehicleData,
        driver_name: vehicle.driver?.driverProfile?.full_name || null,
        driver_phone: vehicle.driver?.driverProfile?.phone || null,
        driver_status: vehicle.driver?.driverProfile?.status || null
      };
    });

    res.json({
      success: true,
      data: enhancedVehicles,
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicle.findByPk(id, {
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'username'],
          include: [
            {
              model: require('../models').DriverProfile,
              as: 'driverProfile',
              attributes: ['full_name', 'phone', 'status'],
              required: false
            }
          ],
          required: false
        }
      ]
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const vehicleData = vehicle.toJSON();
    const enhancedVehicle = {
      ...vehicleData,
      driver_name: vehicle.driver?.driverProfile?.full_name || null,
      driver_phone: vehicle.driver?.driverProfile?.phone || null,
      driver_status: vehicle.driver?.driverProfile?.status || null
    };

    res.json({
      success: true,
      data: enhancedVehicle
    });
  } catch (err) {
    next(err);
  }
};

// Create new vehicle
exports.createVehicle = async (req, res, next) => {
  const transaction = await require('../models').sequelize.transaction();
  
  try {
    // Create the vehicle first
    const vehicle = await Vehicle.create(req.body, { transaction });
    
    // Get tire positions for this vehicle type using the model method
    const tirePositions = vehicle.getTirePositions();
    
    // Create empty tire slots for each position
    const { VehicleTire } = require('../models');
    const tireSlots = tirePositions.map(position => ({
      vehicle_id: vehicle.id,
      position: position,
      status: 'empty', // Mark as empty initially
      current_pressure: 0,
      recommended_pressure: 35,
      tread_depth: 0,
      temperature: 25.0,
      condition: 'good'
    }));
    
    // Create all tire slots
    await VehicleTire.bulkCreate(tireSlots, { transaction });
    
    await transaction.commit();
    
    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully with tire positions',
      data: {
        ...vehicle.toJSON(),
        tire_positions: tirePositions
      }
    });
  } catch (err) {
    await transaction.rollback();
    
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    next(err);
  }
};

// Update vehicle
exports.updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    await vehicle.update(req.body);

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: vehicle
    });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    next(err);
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    await vehicle.destroy();

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Assign driver to vehicle
exports.assignDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driver_id } = req.body;
    const { Vehicle, User, DriverProfile } = require('../models');

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // --- LOGIC FOR UNASSIGNMENT ---
    if (!driver_id) {
      const oldDriverId = vehicle.driver_id;
      if (oldDriverId) {
        const oldDriverProfile = await DriverProfile.findOne({ where: { user_id: oldDriverId } });
        if (oldDriverProfile) {
            await oldDriverProfile.update({ status: 'available' });
        }
      }
      await vehicle.update({ driver_id: null });
      return res.json({ success: true, message: 'Driver unassigned successfully', data: vehicle });
    }

    // --- LOGIC FOR ASSIGNMENT ---

    // FIX: Add a check to prevent a driver from being assigned to two vehicles
    const existingAssignment = await Vehicle.findOne({
        where: { driver_id: driver_id }
    });
    if (existingAssignment) {
        return res.status(400).json({ success: false, message: `Driver is already assigned to vehicle ${existingAssignment.license_plate}.` });
    }
    
    const driver = await User.findOne({
      where: { id: driver_id, role: 'driver' },
      include: [{ model: DriverProfile, as: 'driverProfile', required: true }]
    });

    if (!driver) {
      return res.status(400).json({ success: false, message: 'Driver not found or invalid role.' });
    }

    if (driver.driverProfile.status !== 'available') {
      return res.status(400).json({ success: false, message: `Driver is not available. Current status: ${driver.driverProfile.status}` });
    }

    // Make the previous driver available if there was one
    const oldDriverId = vehicle.driver_id;
    if (oldDriverId && oldDriverId !== driver_id) {
      const oldDriverProfile = await DriverProfile.findOne({ where: { user_id: oldDriverId } });
      if (oldDriverProfile) {
        await oldDriverProfile.update({ status: 'available' });
      }
    }
    
    await vehicle.update({ driver_id });
    // FIX: Use 'busy' to match the allowed values
    await driver.driverProfile.update({ status: 'busy' }); 
    
    return res.json({ success: true, message: 'Driver assigned successfully', data: vehicle });

  } catch (err) {
    console.error('Error in assignDriver:', err);
    next(err);
  }
};

// Get available drivers
exports.getAvailableDrivers = async (req, res, next) => {
  try {
    // FIX: Exclude drivers who are already assigned to a vehicle
    const assignedDriverIds = (await require('../models').Vehicle.findAll({
        attributes: ['driver_id'],
        where: {
            driver_id: {
                [require('sequelize').Op.ne]: null
            }
        }
    })).map(v => v.driver_id);

    const drivers = await require('../models').User.findAll({
      where: {
        role: 'driver',
        id: { [require('sequelize').Op.notIn]: assignedDriverIds } // Exclude assigned drivers
      },
      include: [
        {
          model: require('../models').DriverProfile,
          as: 'driverProfile',
          where: { status: 'available' }, // Only show drivers marked as available
          required: true
        }
      ],
      order: [['driverProfile', 'full_name', 'ASC']]
    });
    
    const formattedDrivers = drivers.map(driver => ({
      id: driver.id,
      username: driver.username,
      full_name: driver.driverProfile.full_name,
      phone: driver.driverProfile.phone,
      status: driver.driverProfile.status
    }));

    res.json({
      success: true,
      data: formattedDrivers
    });
  } catch (err) {
    next(err);
  }
};

// Get vehicle statistics
exports.getVehicleStatistics = async (req, res, next) => {
  try {
    const totalVehicles = await Vehicle.count();
    const availableVehicles = await Vehicle.count({ where: { status: 'available' } });
    const inUseVehicles = await Vehicle.count({ where: { status: 'in_use' } });
    const maintenanceVehicles = await Vehicle.count({ where: { status: 'maintenance' } });

    res.json({
      success: true,
      data: {
        total: totalVehicles,
        available: availableVehicles,
        in_use: inUseVehicles,
        maintenance: maintenanceVehicles
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get service history for a vehicle
exports.getServiceHistory = async (req, res, next) => {
  try {
    // FIX 2: Use 'id' to match the route parameter definition '/:id/history'
    const { id } = req.params; 
    
    const vehicle = await Vehicle.findByPk(id); // Use id here
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // This is a placeholder, assuming you will implement service history later.
    res.json({
      success: true,
      data: []
    });
  } catch (err) {
    next(err);
  }
};
