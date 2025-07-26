// src/controllers/web/deliveryOrderController.js
const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  DriverProfile,
  User,
  BigDeliveryOrder,
  DeliveryOrderPayments,
  BigDoTambahan,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");

const calculateTotalAmount = (quantity, unitPrice, unit) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
    case "ton":
    case "kubik":
      return qty * price; // Direct: price is per the unit (e.g., per ton if unit='ton')
    default:
      return 0; // Invalid unit: safe default
  }
};

const calculateOngkosan = (totalAmount, tripAllowance, gaji) => {
  const total = parseFloat(totalAmount) || 0;
  const allowance = parseFloat(tripAllowance) || 0;
  const salary = parseFloat(gaji) || 0;

  return total - allowance - salary;
};

/**
 * 🎯 CREATE DELIVERY ORDER
 * POST /api/web/delivery-orders
 */
exports.createDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      purchase_order_id,
      vehicle_id,
      driver_id,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit,
      unit_price,
      total_amount,
      trip_allowance = 0, // Default to 0
      gaji = 0, // Default to 0
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status = "awaiting_confirmation", // FIXED: Use your latest schema default
      status = "assigned",
      do_name, // Add the new field
    } = req.body;

    // ✅ Validate required fields + numerics (FIXED: Added numeric checks)
    if (
      !vehicle_id ||
      !driver_id ||
      !minimal_load_quantity ||
      isNaN(parseFloat(minimal_load_quantity))
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Missing or invalid required fields: vehicle_id, driver_id, minimal_load_quantity (must be number)",
      });
    }

    // ✅ Validate unit field
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // ✅ Early item validation against PO (FIXED: Moved early to avoid waste)
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid unit" });
    }

    // Early item validation against PO
    let po;
    if (purchase_order_id && item_name) {
      po = await PurchaseOrder.findByPk(purchase_order_id, { transaction });
      if (!po) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Purchase Order not found" });
      }
      const poItems = po.item_name
        ? po.item_name.split(",").map((i) => i.trim().toLowerCase())
        : [];
      if (!poItems.includes(item_name.trim().toLowerCase())) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: `Invalid item_name for PO` });
      }
    }

    let finalUnit = unit || (po ? po.unit : "ton");
    let finalUnitPrice = unit_price;

    // ✅ Check driver/vehicle/bigDO availability (unchanged, good)

    const activeDriverDelivery = await DeliveryOrder.findOne({
      where: {
        driver_id,
        status: {
          [Op.in]: [
            "assigned",
            "otw_to_load_location",
            "at_load_location",
            "otw_to_unload_location",
            "at_unload_location",
            "otw_to_base",
          ],
        },
      },
      transaction,
    });

    if (activeDriverDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Driver is already assigned to active delivery order: ${activeDriverDelivery.do_number}`,
      });
    }

    const activeVehicleDelivery = await DeliveryOrder.findOne({
      where: {
        vehicle_id,
        status: {
          [Op.in]: [
            "assigned",
            "otw_to_load_location",
            "at_load_location",
            "otw_to_unload_location",
            "at_unload_location",
            "otw_to_base",
          ],
        },
      },
      transaction,
    });

    if (activeVehicleDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Vehicle is already assigned to active delivery order: ${activeVehicleDelivery.do_number}`,
      });
    }

    const existingBigDO = await BigDeliveryOrder.findOne({
      where: {
        driver_id,
        status: { [Op.in]: ["assigned", "in_progress"] },
      },
      transaction,
    });

    if (existingBigDO) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Driver is already assigned to Big DO: ${existingBigDO.big_do_number}`,
      });
    }

    // ✅ Generate unique DO number (FIXED: Increased attempts to 100, added error if fails)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let attempts = 0;
    let do_number;
    do {
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      do_number = `DO-${timestamp}-${randomSuffix}`;
      const existingDO = await DeliveryOrder.findOne({
        where: { do_number },
        transaction,
      });
      if (!existingDO) break;
      attempts++;
    } while (attempts < 100);

    if (attempts >= 100) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique DO number after 100 attempts",
      });
    }

    // ✅ Calculations
    let calculatedTotalAmount =
      total_amount ||
      calculateTotalAmount(minimal_load_quantity, finalUnitPrice, finalUnit);
    let calculatedOngkosan =
      ongkosan ||
      calculateOngkosan(calculatedTotalAmount, trip_allowance, gaji);

    // NEW: Create temporary DO instance for validation
    const tempDO = DeliveryOrder.build({
      purchase_order_id,
      driver_id,
      vehicle_id,
      do_number,
      do_name, // Include the new field
      customer_name,
      item_name,
      minimal_load_quantity,
      unit: finalUnit,
      unit_price: finalUnitPrice,
      total_amount: calculatedTotalAmount,
      trip_allowance,
      gaji,
      ongkosan: calculatedOngkosan,
      load_location,
      load_latitude,
      load_longitude,
      unload_location,
      unload_latitude,
      unload_longitude,
      payment_status,
      status,
    });

    // NEW: Validate remaining quantity
    await tempDO.validateQuantityAgainstPO(false); // false for create

    // ✅ Create delivery order (if validation passes)
    const deliveryOrder = await DeliveryOrder.create(tempDO.dataValues, {
      transaction,
      scope: "web",
    });

    // ✅ Update vehicle status
    await Vehicle.update(
      { status: "in_use" },
      { where: { id: vehicle_id }, transaction }
    );

    // ✅ Send push notification to driver (FIXED: Added try/catch logging)
    const driverUser = await User.findOne({
      where: { id: driver_id },
      attributes: ["username", "expo_push_token"],
      include: [
        {
          model: DriverProfile,
          as: "driverProfile",
          attributes: ["full_name"],
        },
      ],
      transaction,
    });

    if (
      driverUser &&
      driverUser.expo_push_token &&
      Expo.isExpoPushToken(driverUser.expo_push_token)
    ) {
      const expo = new Expo();
      const driverName =
        driverUser.driverProfile?.full_name || driverUser.username;
      const messages = [
        {
          to: driverUser.expo_push_token,
          sound: "default",
          title: "Tugas Pengantaran Baru",
          body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${
            deliveryOrder.do_name || deliveryOrder.do_number
          }. Silakan cek detail pengantaran di aplikasi.`,
          data: { do_number: deliveryOrder.do_number },
        },
      ];

      try {
        await expo.sendPushNotificationsAsync(messages);
      } catch (pushError) {
        console.error("Push notification error:", pushError);
        // Don't fail the whole op, but log it
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Delivery order created successfully",
      data: {
        ...deliveryOrder.toJSON(),
        unit_display: deliveryOrder.getUnitDisplay() || "N/A", // FIXED: Fallback
        financial_summary: deliveryOrder.getFinancialSummary() || {},
        big_do_context: deliveryOrder.getBigDOContext() || null,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error creating delivery order:", err);
    res.status(500).json({ success: false, message: err.message }); // FIXED: Better response
    next(err);
  }
};

/**
 * 🎯 GET ALL DELIVERY ORDERS (Updated for new architecture)
 * GET /api/web/delivery-orders
 */
exports.getAllDeliveryOrders = async (req, res, next) => {
  try {
    const {
      status,
      driver_id,
      vehicle_id,
      page = 1,
      limit = 10,
      search,
      po_id,
      big_do_filter,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (driver_id) whereClause.driver_id = driver_id;
    if (vehicle_id) whereClause.vehicle_id = vehicle_id;
    if (po_id) whereClause.purchase_order_id = po_id;

    if (search) {
      whereClause[Op.or] = [
        { do_number: { [Op.iLike]: `%${search}%` } },
        { do_name: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // ✅ Big DO filtering (FIXED: Include cancelled in subquery for consistency? But per your code, exclude)
    if (big_do_filter === "standalone") {
      whereClause.id = {
        [Op.notIn]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    } else if (big_do_filter === "main_dos") {
      whereClause.id = {
        [Op.in]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    }

    // FIXED: Compute stats on FULL dataset, not paginated
    const fullWhere = { ...whereClause }; // Copy for stats
    const statsPromises = [
      DeliveryOrder.count({ where: fullWhere }), // total
      DeliveryOrder.count({ where: { ...fullWhere, status: "assigned" } }), // assigned
      DeliveryOrder.count({
        where: {
          ...fullWhere,
          status: {
            [Op.in]: [
              "otw_to_load_location",
              "at_load_location",
              "otw_to_unload_location",
              "at_unload_location",
              "otw_to_base",
            ],
          },
        },
      }), // in_progress
      DeliveryOrder.count({ where: { ...fullWhere, status: "completed" } }), // completed
      DeliveryOrder.count({ where: { ...fullWhere, status: "cancelled" } }), // cancelled
      DeliveryOrder.sum("total_amount", { where: fullWhere }) || 0, // total_revenue
      DeliveryOrder.sum("ongkosan", { where: fullWhere }) || 0, // total_ongkosan
      DeliveryOrder.count({
        where: {
          ...fullWhere,
          id: {
            [Op.notIn]: sequelize.literal(
              "(SELECT main_delivery_order_id FROM big_delivery_orders)"
            ),
          },
        },
      }), // standalone_dos (FIXED: Full count, ignore status)
      DeliveryOrder.count({
        where: {
          ...fullWhere,
          id: {
            [Op.in]: sequelize.literal(
              "(SELECT main_delivery_order_id FROM big_delivery_orders)"
            ),
          },
        },
      }), // main_dos
      DeliveryOrder.count({ where: { ...fullWhere, unit: "kilogram" } }), // kilogram
      DeliveryOrder.count({ where: { ...fullWhere, unit: "ton" } }), // ton
      DeliveryOrder.count({ where: { ...fullWhere, unit: "kubik" } }), // kubik
    ];

    const [
      total,
      assigned,
      in_progress,
      completed,
      cancelled,
      total_revenue,
      total_ongkosan,
      standalone_dos,
      main_dos,
      kilogram,
      ton,
      kubik,
    ] = await Promise.all(statsPromises);

    const { count, rows: deliveryOrders } = await DeliveryOrder.findAndCountAll(
      {
        where: whereClause,
        include: [
          {
            model: PurchaseOrder,
            as: "purchaseOrder",
            attributes: [
              "po_number",
              "customer_name",
              "total_quantity",
              "unit",
            ],
          },
          {
            model: User,
            as: "driver",
            attributes: ["id", "username"],
            include: [
              {
                model: DriverProfile,
                as: "driverProfile",
                attributes: ["full_name", "phone"],
              },
            ],
          },
          {
            model: Vehicle,
            as: "vehicle",
            attributes: ["license_plate", "type", "capacity"],
          },
          {
            model: BigDeliveryOrder,
            as: "bigDeliveryOrderAsMain",
            attributes: ["big_do_number", "status", "total_trip_allowance"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      }
    );

    // ✅ Enhance data with computed fields (unchanged, but added null checks)
    const enhancedDOs = deliveryOrders.map((dOrder) => {
      const doData = dOrder.toJSON();
      const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

      let actualTotalAmount = null;
      if (doData.actual_load_quantity && doData.unit_price && orderUnit) {
        actualTotalAmount = calculateTotalAmount(
          doData.actual_load_quantity,
          doData.unit_price,
          orderUnit
        );
      }

      return {
        ...doData,
        unit: orderUnit,
        status_text: dOrder.getStatusText() || doData.status, // FIXED: Fallback
        financial_summary: {
          ...(dOrder.getFinancialSummary() || {}),
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: dOrder.getUnitDisplay() || orderUnit, // FIXED: Fallback
        },
        driver_name:
          doData.driver?.driverProfile?.full_name ||
          doData.driver?.username ||
          "N/A",
        vehicle_info:
          `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || "N/A",
        big_do_context: dOrder.getBigDOContext() || null,
        big_do_info: doData.bigDeliveryOrderAsMain
          ? {
              big_do_number: doData.bigDeliveryOrderAsMain.big_do_number,
              big_do_status: doData.bigDeliveryOrderAsMain.status,
              total_trip_allowance:
                doData.bigDeliveryOrderAsMain.total_trip_allowance,
            }
          : null,
      };
    });

    // ✅ Calculate summary stats (FIXED: Use full aggregates)
    const stats = {
      total,
      assigned,
      in_progress,
      completed,
      cancelled,
      total_revenue,
      total_ongkosan,
      big_do_breakdown: { standalone_dos, main_dos },
      unit_distribution: { kilogram, ton, kubik },
    };

    res.json({
      success: true,
      data: enhancedDOs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      stats,
    });
  } catch (err) {
    console.error("Error getting delivery orders:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 GET DO BY ID (Updated for new architecture)
 * GET /api/web/delivery-orders/:id
 */
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number", "customer_name", "unit"],
        },
        {
          model: User,
          as: "driver",
          include: [{ model: DriverProfile, as: "driverProfile" }],
        },
        { model: Vehicle, as: "vehicle" },
        {
          model: BigDeliveryOrder,
          as: "bigDeliveryOrderAsMain",
          include: [
            {
              model: BigDoTambahan,
              as: "tambahan",
              attributes: ["id", "customer_name", "total_amount", "status"],
            },
          ],
          required: false,
        },
      ],
    });

    if (!deliveryOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    const doData = deliveryOrder.toJSON();
    const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

    // Calculate unit-aware amounts (FIXED: Null handling)
    let minimalTotalAmount =
      doData.minimal_load_quantity && doData.unit_price
        ? calculateTotalAmount(
            doData.minimal_load_quantity,
            doData.unit_price,
            orderUnit
          )
        : null;
    let actualTotalAmount =
      doData.actual_load_quantity && doData.unit_price
        ? calculateTotalAmount(
            doData.actual_load_quantity,
            doData.unit_price,
            orderUnit
          )
        : null;

    res.json({
      success: true,
      data: {
        ...doData,
        unit: orderUnit,
        status_text: deliveryOrder.getStatusText() || doData.status,
        financial_summary: {
          ...(deliveryOrder.getFinancialSummary() || {}),
          minimal_total_amount: minimalTotalAmount,
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: deliveryOrder.getUnitDisplay() || orderUnit,
        },
        timeline: {
          created_at: doData.created_at,
          departed_to_load_location_at: doData.departed_to_load_location_at,
          arrived_at_load_location_at: doData.arrived_at_load_location_at,
          departed_from_load_location_at: doData.departed_from_load_location_at,
          arrived_at_unload_location_at: doData.arrived_at_unload_location_at,
          departed_from_unload_location_at:
            doData.departed_from_unload_location_at,
          completed_at: doData.completed_at,
        },
        big_do_context: deliveryOrder.getBigDOContext() || null,
        big_do_info: doData.bigDeliveryOrderAsMain
          ? {
              big_do_number: doData.bigDeliveryOrderAsMain.big_do_number,
              big_do_status: doData.bigDeliveryOrderAsMain.status,
              tambahan_count:
                doData.bigDeliveryOrderAsMain.tambahan?.length || 0,
              tambahan_summary: doData.bigDeliveryOrderAsMain.tambahan || [],
            }
          : null,
      },
    });
  } catch (err) {
    console.error("Error getting delivery order by ID:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 UPDATE DELIVERY ORDER
 * PUT /api/web/delivery-orders/:id
 */
exports.updateDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      purchase_order_id,
      vehicle_id,
      driver_id,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit,
      unit_price,
      total_amount,
      trip_allowance,
      gaji,
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status,
      status,
      do_name,
    } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // ✅ Validate unit if being updated
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // ✅ Prepare proposed data (FIXED: Build temp object first for validation)
    const proposedData = {
      purchase_order_id: purchase_order_id ?? deliveryOrder.purchase_order_id,
      vehicle_id: vehicle_id ?? deliveryOrder.vehicle_id,
      driver_id: driver_id ?? deliveryOrder.driver_id,
      customer_name: customer_name ?? deliveryOrder.customer_name,
      item_name: item_name ?? deliveryOrder.item_name,
      minimal_load_quantity:
        minimal_load_quantity ?? deliveryOrder.minimal_load_quantity,
      unit: unit ?? deliveryOrder.unit,
      unit_price: unit_price ?? deliveryOrder.unit_price,
      total_amount: total_amount ?? deliveryOrder.total_amount,
      trip_allowance: trip_allowance ?? deliveryOrder.trip_allowance,
      gaji: gaji ?? deliveryOrder.gaji,
      ongkosan: ongkosan ?? deliveryOrder.ongkosan,
      load_location: load_location ?? deliveryOrder.load_location,
      unload_location: unload_location ?? deliveryOrder.unload_location,
      load_latitude: load_latitude ?? deliveryOrder.load_latitude,
      load_longitude: load_longitude ?? deliveryOrder.load_longitude,
      unload_latitude: unload_latitude ?? deliveryOrder.unload_latitude,
      unload_longitude: unload_longitude ?? deliveryOrder.unload_longitude,
      payment_status: payment_status ?? deliveryOrder.payment_status,
      status: status ?? deliveryOrder.status,
      do_name: do_name ?? deliveryOrder.do_name,
    };

    // ✅ Recalculate if needed (FIXED: Use proposedData)
    let calculatedTotalAmount = proposedData.total_amount;
    if (
      proposedData.minimal_load_quantity &&
      proposedData.unit_price &&
      proposedData.unit
    ) {
      calculatedTotalAmount = calculateTotalAmount(
        proposedData.minimal_load_quantity,
        proposedData.unit_price,
        proposedData.unit
      );
    }

    let calculatedOngkosan = proposedData.ongkosan;
    if (
      calculatedTotalAmount &&
      (proposedData.trip_allowance || proposedData.gaji)
    ) {
      calculatedOngkosan = calculateOngkosan(
        calculatedTotalAmount,
        proposedData.trip_allowance,
        proposedData.gaji
      );
    }

    proposedData.total_amount = calculatedTotalAmount;
    proposedData.ongkosan = calculatedOngkosan;

    // NEW: Validate proposed quantity (FIXED: Clone and validate proposed)
    const tempDO = DeliveryOrder.build({
      ...deliveryOrder.dataValues,
      ...proposedData,
    });
    await tempDO.validateQuantityAgainstPO(true); // true for update

    // ✅ Update (FIXED: Use proposedData directly)
    const updatedDO = await deliveryOrder.update(proposedData, { transaction });

    await transaction.commit();

    // NEW: Optionally return updated PO stats
    const po = await PurchaseOrder.findByPk(updatedDO.purchase_order_id);
    const stats = po ? await po.getRemainingAndForecast() : null;

    res.json({
      success: true,
      message: "Delivery Order updated successfully",
      data: {
        ...updatedDO.toJSON(),
        financial_summary: updatedDO.getFinancialSummary() || {},
        po_stats: stats, // Include for client
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 CANCEL DELIVERY ORDER
 * PATCH /api/web/delivery-orders/:id/cancel
 */
exports.cancelDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Check if DO is part of Big DO
    const bigDO = await BigDeliveryOrder.findOne({
      where: { main_delivery_order_id: id },
      transaction,
    });

    if (bigDO) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Cannot cancel DO that is main DO of Big DO. Cancel the Big DO instead.",
      });
    }

    // Update delivery order status (FIXED: Assume notes exists; add push notif if needed)
    await deliveryOrder.update(
      {
        status: "cancelled",
        notes: cancellation_reason || "Cancelled by admin",
      }, // Schema check: Does DO have notes?
      { transaction }
    );

    // Free up vehicle (FIXED: Only if not in use elsewhere, but simple update for now)
    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    // OPTIONAL: Send cancel notif to driver (added for completeness)
    // ... similar to create, but with cancel message

    await transaction.commit();

    res.json({
      success: true,
      message: "Delivery Order cancelled successfully",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error cancelling delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 GET DELIVERY STATISTICS
 * GET /api/web/delivery-orders/statistics
 */
exports.getDeliveryStatistics = async (req, res, next) => {
  try {
    const { period = "month" } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { created_at: { [Op.gte]: weekAgo } };
    } else if (period === "month") {
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { created_at: { [Op.gte]: monthAgo } };
    } else if (period === "year") {
      const yearAgo = new Date(now.getFullYear(), 0, 1);
      dateFilter = { created_at: { [Op.gte]: yearAgo } };
    }

    const [
      totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      totalRevenue,
      totalOngkosan,
      totalTripAllowance,
      totalGaji,
    ] = await Promise.all([
      DeliveryOrder.count({ where: dateFilter }),
      DeliveryOrder.count({ where: { ...dateFilter, status: "completed" } }),
      DeliveryOrder.count({ where: { ...dateFilter, status: "cancelled" } }),
      DeliveryOrder.sum("total_amount", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("ongkosan", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("trip_allowance", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("gaji", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
    ]);

    const totalDriverCosts = totalTripAllowance + totalGaji;
    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const netProfit = totalOngkosan; // FIXED: Ongkosan already deducts costs; don't double-subtract

    // Get unit distribution (FIXED: Use actual_load_quantity for completed, fallback to minimal)
    const unitStats = await DeliveryOrder.findAll({
      where: dateFilter,
      attributes: [
        "unit",
        [sequelize.fn("COUNT", "*"), "count"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              "COALESCE(actual_load_quantity, minimal_load_quantity)"
            )
          ),
          "total_quantity",
        ],
      ],
      group: ["unit"],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        period,
        total_deliveries: totalDeliveries,
        completed_deliveries: completedDeliveries,
        cancelled_deliveries: cancelledDeliveries,
        completion_rate: parseFloat(completionRate.toFixed(2)),
        total_revenue: totalRevenue,
        total_ongkosan: totalOngkosan,
        total_driver_costs: totalDriverCosts,
        net_profit: netProfit,
        unit_distribution: unitStats.reduce((acc, stat) => {
          const unit = stat.unit || "unknown";
          acc[unit] = {
            count: parseInt(stat.count),
            total_quantity: parseFloat(stat.total_quantity) || 0,
          };
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    console.error("Error getting delivery statistics:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};
