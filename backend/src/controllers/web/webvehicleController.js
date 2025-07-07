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
    const { id } = req.params; // ✅ FIXED: Use 'id' instead of 'vehicleId'
    const { driver_id } = req.body;

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (driver_id) {
      const driver = await User.findOne({
        where: { id: driver_id, role: "driver" },
        include: [
          {
            model: require("../../models").DriverProfile,
            as: "driverProfile",
            required: true,
          },
        ],
      });

      if (!driver) {
        return res.status(400).json({
          success: false,
          message: "Driver not found or invalid",
        });
      }

      if (driver.driverProfile.status !== "available") {
        return res.status(400).json({
          success: false,
          message: "Driver is not available",
        });
      }
    }

    await vehicle.update({ driver_id });

    res.json({
      success: true,
      message: "Driver assigned successfully",
      data: vehicle,
    });
  } catch (err) {
    console.error("Error in assignDriver:", err);
    next(err);
  }
};

// Get available drivers
exports.getAvailableDrivers = async (req, res, next) => {
  try {
    const drivers = await User.findAll({
      where: { role: "driver" },
      include: [
        {
          model: require("../../models").DriverProfile,
          as: "driverProfile",
          where: { status: "available" },
          required: true,
        },
      ],
      order: [["driverProfile", "full_name", "ASC"]],
    });

    const formattedDrivers = drivers.map((driver) => ({
      id: driver.id,
      username: driver.username,
      full_name: driver.driverProfile.full_name,
      phone: driver.driverProfile.phone,
      status: driver.driverProfile.status,
    }));

    res.json({
      success: true,
      data: formattedDrivers,
    });
  } catch (err) {
    console.error("Error in getAvailableDrivers:", err);
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
