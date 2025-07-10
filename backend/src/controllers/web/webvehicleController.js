// backend/src/controllers/web/webvehicleController.js
const { Vehicle, User, VehicleTire, TireInventory } = require("../../models");
const { Op } = require("sequelize");

// ✅ FIXED: Get all vehicles with proper response format for frontend
exports.getAllVehicles = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { license_plate: { [Op.iLike]: `%${search}%` } },
        { type: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const result = await Vehicle.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "driver",
          attributes: ["id", "username"],
          include: [
            {
              model: require("../../models").DriverProfile,
              as: "driverProfile",
              attributes: ["full_name", "phone", "status"],
              required: false,
            },
          ],
          required: false,
        },
        {
          model: VehicleTire,
          as: "tires",
          where: { status: "active" },
          required: false,
          include: [
            {
              model: TireInventory,
              as: "tireInventory",
              attributes: ["tire_brand", "tire_size"],
              required: false,
            },
          ],
        },
      ],
      order: [["license_plate", "ASC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    // Enhanced vehicle data with driver and tire information
    const enhancedVehicles = result.rows.map((vehicle) => {
      const vehicleData = vehicle.toJSON();

      // Calculate tire statistics
      const tires = vehicle.tires || [];
      const tireStats = {
        total_installed: tires.length,
        total_expected:
          (vehicle.tire_count || 0) + (vehicle.spare_tire_count || 0),
        needs_attention: tires.filter(
          (t) =>
            t.condition === "poor" ||
            t.condition === "replace" ||
            (t.current_pressure &&
              t.recommended_pressure &&
              (t.current_pressure < t.recommended_pressure * 0.8 ||
                t.current_pressure > t.recommended_pressure * 1.2))
        ).length,
        good_condition: tires.filter((t) => t.condition === "good").length,
      };

      return {
        ...vehicleData,
        driver_name: vehicle.driver?.driverProfile?.full_name || null,
        driver_phone: vehicle.driver?.driverProfile?.phone || null,
        driver_status: vehicle.driver?.driverProfile?.status || null,
        tire_stats: tireStats,
      };
    });

    // ✅ COMPATIBLE: Frontend expects both .records and direct data
    res.json({
      success: true,
      data: enhancedVehicles,
      records: enhancedVehicles, // ✅ ADD: For frontend compatibility
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit),
      },
    });
  } catch (err) {
    console.error("Error in getAllVehicles:", err);
    next(err);
  }
};

// Get vehicle by ID with complete tire information
exports.getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByPk(id, {
      include: [
        {
          model: User,
          as: "driver",
          attributes: ["id", "username"],
          include: [
            {
              model: require("../../models").DriverProfile,
              as: "driverProfile",
              attributes: ["full_name", "phone", "status"],
              required: false,
            },
          ],
          required: false,
        },
        {
          model: VehicleTire,
          as: "tires",
          where: { status: "active" },
          required: false,
          include: [
            {
              model: TireInventory,
              as: "tireInventory",
              attributes: ["tire_brand", "tire_size", "tire_type"],
              required: false,
            },
          ],
        },
      ],
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    const vehicleData = vehicle.toJSON();
    const enhancedVehicle = {
      ...vehicleData,
      driver_name: vehicle.driver?.driverProfile?.full_name || null,
      driver_phone: vehicle.driver?.driverProfile?.phone || null,
      driver_status: vehicle.driver?.driverProfile?.status || null,
      tire_positions: vehicle.getTirePositions
        ? vehicle.getTirePositions()
        : [],
    };

    res.json({
      success: true,
      data: enhancedVehicle,
    });
  } catch (err) {
    console.error("Error in getVehicleById:", err);
    next(err);
  }
};

// Create new vehicle
exports.createVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.create(req.body);

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    console.error("Error in createVehicle:", err);
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
        message: "Vehicle not found",
      });
    }

    await vehicle.update(req.body);

    res.json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    console.error("Error in updateVehicle:", err);
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
        message: "Vehicle not found",
      });
    }

    await vehicle.destroy();

    res.json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (err) {
    console.error("Error in deleteVehicle:", err);
    next(err);
  }
};

// ✅ FIXED: Assign driver to vehicle - parameter consistency
exports.assignDriver = async (req, res, next) => {
  try {
    const { id } = req.params;  // ← Changed from vehicleId to id
    const { driver_id } = req.body;
    
    // Debug logs
    console.log('Assign driver request:');
    console.log('Vehicle ID from params:', id);
    console.log('Driver ID from body:', driver_id);
    console.log('Vehicle ID type:', typeof id);
    
    // Validate vehicle ID parameter
    if (!id || id === 'undefined') {
      return res.status(400).json({ 
        success: false,
        message: 'Vehicle ID is required in URL parameters'
      });
    }
    
    // Parse vehicle ID to number
    const parsedVehicleId = parseInt(id, 10);
    if (isNaN(parsedVehicleId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid vehicle ID format. Must be a number.'
      });
    }
    
    const { Vehicle, DriverProfile } = require('../../models');

    const vehicle = await Vehicle.findByPk(parsedVehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false,
        message: `Vehicle with ID ${parsedVehicleId} not found`
      });
    }

    // Rest of your assignment logic remains the same...
    
    if (driver_id === null) {
      const oldDriverId = vehicle.driver_id;
      await vehicle.update({ driver_id: null });
      
      if (oldDriverId) {
        await DriverProfile.update(
          { status: 'available' },
          { where: { user_id: oldDriverId } }
        );
        console.log(`Driver ${oldDriverId} status updated to available`);
      }
      
      console.log(`Driver unassigned from vehicle ${parsedVehicleId}`);
    } else {
      const oldDriverId = vehicle.driver_id;
      if (oldDriverId) {
        await DriverProfile.update(
          { status: 'available' },
          { where: { user_id: oldDriverId } }
        );
        console.log(`Old driver ${oldDriverId} status updated to available`);
      }

      await vehicle.update({ driver_id });
      await DriverProfile.update(
        { status: 'available' },
        { where: { user_id: driver_id } }
      );
      
      console.log(`Driver ${driver_id} assigned to vehicle ${parsedVehicleId}`);
    }

    res.json({ 
      success: true,
      message: 'Driver assignment updated successfully',
      vehicle_id: parsedVehicleId,
      driver_id: driver_id
    });
  } catch (err) {
    console.error('Error in assignDriver:', err);
    next(err);
  }
};

// Get available drivers
exports.getAvailableDrivers = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { User, DriverProfile, Vehicle } = require('../../models');

    // Get all driver IDs that are currently assigned to vehicles
    const assignedVehicles = await Vehicle.findAll({
      attributes: ['driver_id'],
      where: {
        driver_id: {
          [Op.not]: null
        }
      },
      raw: true
    });

    const assignedDriverIds = assignedVehicles.map(vehicle => vehicle.driver_id);
    
    console.log('Assigned driver IDs:', assignedDriverIds);

    // Build the where condition for User
    const userWhereCondition = {
      role: 'driver'
    };

    // Only add the NOT IN condition if there are assigned drivers
    if (assignedDriverIds.length > 0) {
      userWhereCondition.id = {
        [Op.notIn]: assignedDriverIds
      };
    }

    console.log('User where condition:', userWhereCondition);

    const drivers = await User.findAll({
      where: userWhereCondition,
      include: [{
        model: DriverProfile,
        as: 'driverProfile',
        where: { 
          status: 'available' 
        },
        required: true
      }],
      order: [['driverProfile', 'full_name', 'ASC']]
    });

    const formattedDrivers = drivers.map(driver => ({
      id: driver.id,
      username: driver.username,
      full_name: driver.driverProfile.full_name,
      phone: driver.driverProfile.phone,
      status: driver.driverProfile.status
    }));

    console.log('Available drivers found:', formattedDrivers.length);
    console.log('Available drivers:', formattedDrivers);

    res.json(formattedDrivers);
  } catch (err) {
    console.error('Error in getAvailableDrivers:', err);
    next(err);
  }
};

// Get vehicle statistics including tire stats
exports.getVehicleStatistics = async (req, res, next) => {
  try {
    const totalVehicles = await Vehicle.count();
    const availableVehicles = await Vehicle.count({
      where: { status: "available" },
    });
    const inUseVehicles = await Vehicle.count({ where: { status: "in_use" } });
    const maintenanceVehicles = await Vehicle.count({
      where: { status: "maintenance" },
    });

    // ✅ SAFE: Tire statistics with error handling
    let tiresNeedingAttention = 0;
    let totalActiveTires = 0;

    try {
      tiresNeedingAttention = await VehicleTire.count({
        where: {
          status: "active",
          [Op.or]: [
            { condition: "poor" },
            { condition: "replace" },
            { tread_depth: { [Op.lt]: 2.0 } },
          ],
        },
      });

      totalActiveTires = await VehicleTire.count({
        where: { status: "active" },
      });
    } catch (tireError) {
      console.warn("Tire statistics not available:", tireError.message);
    }

    res.json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          available: availableVehicles,
          in_use: inUseVehicles,
          maintenance: maintenanceVehicles,
        },
        tires: {
          total_active: totalActiveTires,
          needs_attention: tiresNeedingAttention,
          good_condition: totalActiveTires - tiresNeedingAttention,
        },
      },
    });
  } catch (err) {
    console.error("Error in getVehicleStatistics:", err);
    next(err);
  }
};

// ✅ FIXED: Get service history for a vehicle - parameter consistency
exports.getServiceHistory = async (req, res, next) => {
  try {
    const { id } = req.params; // ✅ FIXED: Use 'id' instead of 'vehicle_id'

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // ✅ TODO: Implement actual service history fetching
    res.json({
      success: true,
      data: [],
      message: "Service history feature coming soon",
    });
  } catch (err) {
    console.error("Error in getServiceHistory:", err);
    next(err);
  }
};
