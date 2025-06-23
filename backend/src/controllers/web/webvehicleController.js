// src/controllers/web/vehicleController.js
const { Vehicle, User } = require('../../models');
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
              model: require('../../models').DriverProfile,
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
              model: require('../../models').DriverProfile,
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
  try {
    const vehicle = await Vehicle.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
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
    const { vehicleId } = req.params;
    const { driver_id } = req.body;
    
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if driver exists and is available
    if (driver_id) {
      const driver = await User.findOne({
        where: { id: driver_id, role: 'driver' },
        include: [
          {
            model: require('../../models').DriverProfile,
            as: 'driverProfile',
            required: true
          }
        ]
      });

      if (!driver) {
        return res.status(400).json({
          success: false,
          message: 'Driver not found or invalid'
        });
      }

      if (driver.driverProfile.status !== 'available') {
        return res.status(400).json({
          success: false,
          message: 'Driver is not available'
        });
      }
    }

    await vehicle.update({ driver_id });

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      data: vehicle
    });
  } catch (err) {
    next(err);
  }
};

// Get available drivers
exports.getAvailableDrivers = async (req, res, next) => {
  try {
    const drivers = await User.findAll({
      where: { role: 'driver' },
      include: [
        {
          model: require('../../models').DriverProfile,
          as: 'driverProfile',
          where: { status: 'available' },
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
    const { vehicle_id } = req.params;
    
    const vehicle = await Vehicle.findByPk(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // This would require the VehicleService model to be properly set up
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  } catch (err) {
    next(err);
  }
};
