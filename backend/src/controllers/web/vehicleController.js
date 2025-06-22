// src/controllers/web/vehicleController.js
const { Vehicle, VehicleService, DeliveryOrder, User, DriverProfile } = require('../../models');
const { Op } = require('sequelize');

// Get all vehicles with enhanced web features
exports.getAllVehicles = async (req, res, next) => {
  try {
    const { status, maintenance_due, docs_expiring, page = 1, limit = 10, search, driver_assigned } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (driver_assigned === 'true') {
      whereClause.driver_id = { [Op.ne]: null };
    } else if (driver_assigned === 'false') {
      whereClause.driver_id = null;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { license_plate: { [Op.iLike]: `%${search}%` } },
        { type: { [Op.iLike]: `%${search}%` } }
      ];
    }

    let vehicles;
    let count;

    if (maintenance_due === 'true') {
      const maintenanceVehicles = await Vehicle.findMaintenanceDue();
      vehicles = maintenanceVehicles.slice(offset, offset + parseInt(limit));
      count = maintenanceVehicles.length;
    } else if (docs_expiring === 'true') {
      const expiringVehicles = await Vehicle.findDocumentExpiring();
      vehicles = expiringVehicles.slice(offset, offset + parseInt(limit));
      count = expiringVehicles.length;
    } else {
      const result = await Vehicle.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'assignedDriver',
            include: [{
              model: DriverProfile,
              as: 'driverProfile',
              required: false
            }],
            required: false
          },
          {
            model: VehicleService,
            as: 'serviceHistory',
            limit: 1,
            order: [['service_date', 'DESC']],
            required: false
          },
          {
            model: DeliveryOrder,
            as: 'deliveryOrders',
            where: { status: { [Op.ne]: 'cancelled' } },
            required: false,
            limit: 5,
            order: [['created_at', 'DESC']]
          }
        ],
        order: [['license_plate', 'ASC']],
        limit: parseInt(limit),
        offset: offset
      });
      vehicles = result.rows;
      count = result.count;
    }

    // Enhance vehicles with computed data
    const enhancedVehicles = vehicles.map(vehicle => {
      const vehicleData = vehicle.toJSON();
      return {
        ...vehicleData,
        is_maintenance_due: vehicle.isMaintenanceDue(),
        is_tax_due: vehicle.isTaxDue(),
        is_stnk_expired: vehicle.isSTNKExpired(),
        days_until_maintenance: vehicle.next_service_due ? 
          Math.ceil((new Date(vehicle.next_service_due) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        days_until_tax_due: vehicle.tax_due_date ? 
          Math.ceil((new Date(vehicle.tax_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        days_until_stnk_expired: vehicle.stnk_expired_date ? 
          Math.ceil((new Date(vehicle.stnk_expired_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        total_trips: vehicleData.deliveryOrders?.length || 0,
        last_service: vehicleData.serviceHistory?.[0] || null,
        driver_name: vehicleData.assignedDriver?.driverProfile?.full_name || null,
        driver_phone: vehicleData.assignedDriver?.driverProfile?.phone || null,
        driver_status: vehicleData.assignedDriver?.driverProfile?.status || null
      };
    });

    // Calculate summary stats
    const stats = {
      total: count,
      available: enhancedVehicles.filter(v => v.status === 'available').length,
      in_use: enhancedVehicles.filter(v => v.status === 'in_use').length,
      maintenance: enhancedVehicles.filter(v => v.status === 'maintenance').length,
      with_driver: enhancedVehicles.filter(v => v.driver_id).length,
      without_driver: enhancedVehicles.filter(v => !v.driver_id).length,
      maintenance_due: enhancedVehicles.filter(v => v.is_maintenance_due).length,
      docs_expiring: enhancedVehicles.filter(v => v.is_tax_due || v.is_stnk_expired).length
    };

    res.json({
      success: true,
      data: enhancedVehicles,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      },
      stats
    });
  } catch (err) {
    next(err);
  }
};

// Get vehicle by ID with detailed info
exports.getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedDriver',
          include: [{
            model: DriverProfile,
            as: 'driverProfile'
          }],
          required: false
        },
        {
          model: VehicleService,
          as: 'serviceHistory',
          order: [['service_date', 'DESC']]
        },
        {
          model: DeliveryOrder,
          as: 'deliveryOrders',
          order: [['created_at', 'DESC']]
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

    res.json({
      success: true,
      data: {
        ...vehicleData,
        is_maintenance_due: vehicle.isMaintenanceDue(),
        is_tax_due: vehicle.isTaxDue(),
        is_stnk_expired: vehicle.isSTNKExpired(),
        days_until_maintenance: vehicle.next_service_due ? 
          Math.ceil((new Date(vehicle.next_service_due) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        total_trips: vehicleData.deliveryOrders?.length || 0,
        completed_trips: vehicleData.deliveryOrders?.filter(d => d.status === 'completed').length || 0,
        service_count: vehicleData.serviceHistory?.length || 0
      }
    });
  } catch (err) {
    next(err);
  }
};

// Create vehicle (enhanced for web)
exports.createVehicle = async (req, res, next) => {
  try {
    const { driver_id, ...vehicleData } = req.body;
    
    // Validate driver if provided
    if (driver_id) {
      const driver = await User.findOne({
        where: { id: driver_id, role: 'driver' }
      });
      if (!driver) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver selected'
        });
      }
    }

    const newVehicle = await Vehicle.create({
      ...vehicleData,
      driver_id: driver_id || null
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: newVehicle
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
    const { driver_id, ...updateData } = req.body;
    
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Validate driver if provided
    if (driver_id) {
      const driver = await User.findOne({
        where: { id: driver_id, role: 'driver' }
      });
      if (!driver) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver selected'
        });
      }
    }

    const updatedVehicle = await vehicle.update({
      ...updateData,
      driver_id: driver_id || null
    });

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: updatedVehicle
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

    // Check if vehicle has active deliveries
    const activeDeliveries = await DeliveryOrder.count({
      where: {
        vehicle_id: id,
        status: {
          [Op.in]: ['assigned', 'otw_to_load_location', 'at_load_location', 
                   'otw_to_unload_location', 'at_unload_location', 'otw_to_base']
        }
      }
    });

    if (activeDeliveries > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle with active deliveries'
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

// Get available drivers for assignment
exports.getAvailableDrivers = async (req, res, next) => {
  try {
    console.log('🎯 getAvailableDrivers endpoint hit!');
    
    const drivers = await User.findAll({
      where: { role: 'driver' },
      include: [{
        model: DriverProfile,
        as: 'driverProfile',
        where: { status: 'available' },
        required: true
      }],
      attributes: ['id', 'username'],
      order: [[{ model: DriverProfile, as: 'driverProfile' }, 'full_name', 'ASC']]
    });

    console.log(`📊 Found ${drivers.length} available drivers`);

    // FIXED: Wrap in success/data structure to match your other endpoints
    res.json({
      success: true,
      data: drivers.map(driver => ({
        id: driver.id,
        username: driver.username,
        full_name: driver.driverProfile.full_name,
        phone: driver.driverProfile.phone,
        status: driver.driverProfile.status
      }))
    });
  } catch (err) {
    console.error('❌ Error in getAvailableDrivers:', err);
    next(err);
  }
};

// Assign/unassign driver to vehicle
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

    // Validate driver if provided
    if (driver_id) {
      const driver = await User.findOne({
        where: { id: driver_id, role: 'driver' }
      });
      if (!driver) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver selected'
        });
      }
    }

    await vehicle.update({ driver_id: driver_id || null });

    res.json({
      success: true,
      message: driver_id ? 'Driver assigned successfully' : 'Driver unassigned successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get service history
exports.getServiceHistory = async (req, res, next) => {
  try {
    const { vehicle_id } = req.params;
    const history = await VehicleService.findAll({
      where: { vehicle_id },
      order: [['service_date', 'DESC']],
    });
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

// Get vehicle statistics
exports.getVehicleStatistics = async (req, res, next) => {
  try {
    const [
      totalVehicles,
      availableVehicles,
      inUseVehicles,
      maintenanceVehicles,
      maintenanceDueVehicles,
      docsExpiringVehicles,
      vehiclesWithDrivers,
      vehiclesWithoutDrivers
    ] = await Promise.all([
      Vehicle.count(),
      Vehicle.count({ where: { status: 'available' } }),
      Vehicle.count({ where: { status: 'in_use' } }),
      Vehicle.count({ where: { status: 'maintenance' } }),
      Vehicle.findMaintenanceDue().then(vehicles => vehicles.length),
      Vehicle.findDocumentExpiring().then(vehicles => vehicles.length),
      Vehicle.count({ where: { driver_id: { [Op.ne]: null } } }),
      Vehicle.count({ where: { driver_id: null } })
    ]);

    const utilizationRate = totalVehicles > 0 ? (inUseVehicles / totalVehicles) * 100 : 0;

    res.json({
      success: true,
      data: {
        total_vehicles: totalVehicles,
        available_vehicles: availableVehicles,
        in_use_vehicles: inUseVehicles,
        maintenance_vehicles: maintenanceVehicles,
        maintenance_due_vehicles: maintenanceDueVehicles,
        docs_expiring_vehicles: docsExpiringVehicles,
        vehicles_with_drivers: vehiclesWithDrivers,
        vehicles_without_drivers: vehiclesWithoutDrivers,
        utilization_rate: Math.round(utilizationRate * 100) / 100
      }
    });
  } catch (err) {
    next(err);
  }
};
