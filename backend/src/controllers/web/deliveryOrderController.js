// src/controllers/web/deliveryOrderController.js
const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  DriverProfile,
  User,
  BigDeliveryOrder,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");

// 🎯 Unit-aware calculation helper
const calculateTotalAmount = (quantity, unitPrice, unit) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
      return qty * price;
    case "ton":
      return qty * price; // Convert ton to kg for pricing
    case "kubik":
      return qty * price; // Direct kubik pricing
    default:
      return qty * price;
  }
};

const calculateOngkosan = (totalAmount, tripAllowance, gaji) => {
  const total = parseFloat(totalAmount) || 0;
  const allowance = parseFloat(tripAllowance) || 0;
  const salary = parseFloat(gaji) || 0;

  return total - allowance - salary;
};

/**
 * 🎯 CREATE DELIVERY ORDER (Updated for new architecture)
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
      trip_allowance,
      gaji,
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status = "proses_tagihan",
      status = "assigned",
      do_name, // Add the new field
    } = req.body;

    // ✅ Validate required fields
    if (!vehicle_id || !driver_id || !minimal_load_quantity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: vehicle_id, driver_id, minimal_load_quantity",
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

    // ✅ Validate do_name field (optional, add if mandatory)
    // Uncomment if do_name is required:
    // if (!do_name) {
    //   await transaction.rollback();
    //   return res.status(400).json({
    //     success: false,
    //     message: "Delivery order do_name is required",
    //   });
    // }

    // ✅ Get unit and unit_price from PO if not provided
    let finalUnit = unit;
    let finalUnitPrice = unit_price;

    if (purchase_order_id && (!finalUnit || !finalUnitPrice)) {
      const purchaseOrder = await PurchaseOrder.findByPk(purchase_order_id, {
        transaction,
      });
      if (purchaseOrder) {
        if (!finalUnit) {
          finalUnit = purchaseOrder.unit || "ton";
        }
        if (!finalUnitPrice) {
          finalUnitPrice = purchaseOrder.unit_price;
        }
      }
    }

    // Fallback to default unit if still not set
    if (!finalUnit) {
      finalUnit = "ton";
    }

    // ✅ Check driver availability
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

    // ✅ Check vehicle availability
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

    // ✅ Check if driver is already main DO in a Big DO
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

    // ✅ Generate unique DO number
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
    } while (attempts < 10);

    if (attempts >= 10) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique DO number",
      });
    }

    // ✅ Calculate total amount with unit awareness
    let calculatedTotalAmount = total_amount;
    if (finalUnitPrice && minimal_load_quantity && finalUnit) {
      calculatedTotalAmount = calculateTotalAmount(
        minimal_load_quantity,
        finalUnitPrice,
        finalUnit
      );
    }

    // ✅ Create delivery order
    const deliveryOrder = await DeliveryOrder.create(
      {
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
        ongkosan,
        load_location,
        load_latitude,
        load_longitude,
        unload_location,
        unload_latitude,
        unload_longitude,
        payment_status,
        status,
      },
      { transaction }
    );

    // ✅ Update vehicle status
    await Vehicle.update(
      { status: "in_use" },
      { where: { id: vehicle_id }, transaction }
    );

    // ✅ Send push notification to driver
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

    if (driverUser && driverUser.expo_push_token) {
      const expo = new Expo();
      if (Expo.isExpoPushToken(driverUser.expo_push_token)) {
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
        }
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Delivery order created successfully",
      data: {
        ...deliveryOrder.toJSON(),
        unit_display: deliveryOrder.getUnitDisplay(),
        financial_summary: deliveryOrder.getFinancialSummary(),
        big_do_context: deliveryOrder.getBigDOContext(),
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error creating delivery order:", err);
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
        { do_name: { [Op.iLike]: `%${search}%` } }, // Add search by do_name
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // ✅ Big DO filtering (updated for new architecture)
    if (big_do_filter === "standalone") {
      // Show only standalone DOs (not part of any Big DO)
      whereClause.id = {
        [Op.notIn]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    } else if (big_do_filter === "main_dos") {
      // Show only DOs that are main DOs in Big DOs
      whereClause.id = {
        [Op.in]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    }

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

    // ✅ Enhance data with computed fields
    const enhancedDOs = deliveryOrders.map((dOrder) => {
      const doData = dOrder.toJSON();
      const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

      // Calculate unit-aware amounts
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
        status_text: dOrder.getStatusText(),
        financial_summary: {
          ...dOrder.getFinancialSummary(),
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: dOrder.getUnitDisplay(),
        },
        driver_name:
          doData.driver?.driverProfile?.full_name ||
          doData.driver?.username ||
          "N/A",
        vehicle_info:
          `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || "N/A",
        big_do_context: dOrder.getBigDOContext(),
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

    // ✅ Calculate summary stats
    const stats = {
      total: count,
      assigned: enhancedDOs.filter((d) => d.status === "assigned").length,
      in_progress: enhancedDOs.filter((d) =>
        [
          "otw_to_load_location",
          "at_load_location",
          "otw_to_unload_location",
          "at_unload_location",
          "otw_to_base",
        ].includes(d.status)
      ).length,
      completed: enhancedDOs.filter((d) => d.status === "completed").length,
      cancelled: enhancedDOs.filter((d) => d.status === "cancelled").length,
      total_revenue: enhancedDOs.reduce(
        (sum, d) => sum + (parseFloat(d.total_amount) || 0),
        0
      ),
      total_ongkosan: enhancedDOs.reduce(
        (sum, d) => sum + (parseFloat(d.ongkosan) || 0),
        0
      ),
      big_do_breakdown: {
        standalone_dos: enhancedDOs.filter((d) => !d.bigDeliveryOrderAsMain)
          .length,
        main_dos: enhancedDOs.filter((d) => d.bigDeliveryOrderAsMain).length,
      },
      unit_distribution: {
        kilogram: enhancedDOs.filter((d) => d.unit === "kilogram").length,
        ton: enhancedDOs.filter((d) => d.unit === "ton").length,
        kubik: enhancedDOs.filter((d) => d.unit === "kubik").length,
      },
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
          include: [
            {
              model: DriverProfile,
              as: "driverProfile",
            },
          ],
        },
        {
          model: Vehicle,
          as: "vehicle",
        },
        {
          model: BigDeliveryOrder,
          as: "bigDeliveryOrderAsMain",
          include: [
            {
              model: require("../../models").BigDoTambahan,
              as: "tambahan",
              attributes: ["id", "customer_name", "total_amount", "status"],
            },
          ],
          required: false,
        },
      ],
    });

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    const doData = deliveryOrder.toJSON();
    const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

    // Calculate unit-aware amounts
    let minimalTotalAmount = null;
    let actualTotalAmount = null;

    if (doData.unit_price && orderUnit) {
      if (doData.minimal_load_quantity) {
        minimalTotalAmount = calculateTotalAmount(
          doData.minimal_load_quantity,
          doData.unit_price,
          orderUnit
        );
      }
      if (doData.actual_load_quantity) {
        actualTotalAmount = calculateTotalAmount(
          doData.actual_load_quantity,
          doData.unit_price,
          orderUnit
        );
      }
    }

    res.json({
      success: true,
      data: {
        ...doData,
        unit: orderUnit,
        status_text: deliveryOrder.getStatusText(),
        financial_summary: {
          ...deliveryOrder.getFinancialSummary(),
          minimal_total_amount: minimalTotalAmount,
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: deliveryOrder.getUnitDisplay(),
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
        big_do_context: deliveryOrder.getBigDOContext(),
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
    next(err);
  }
};

/**
 * 🎯 UPDATE DELIVERY ORDER
 * PUT /api/web/delivery-orders/:id
 */
exports.updateDeliveryOrder = async (req, res, next) => {
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
      do_name, // Add the new field
    } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id);

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    // ✅ Validate unit if being updated
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // ✅ Recalculate total_amount if relevant fields change
    let calculatedTotalAmount = total_amount;
    if (minimal_load_quantity || unit_price || unit) {
      const quantity =
        minimal_load_quantity || deliveryOrder.minimal_load_quantity;
      const unitPrice = unit_price || deliveryOrder.unit_price;
      const finalUnit = unit || deliveryOrder.unit || "ton";

      if (quantity && unitPrice && finalUnit) {
        calculatedTotalAmount = calculateTotalAmount(
          quantity,
          unitPrice,
          finalUnit
        );
      }
    }

    // gaji

    let calculatedOngkosan = ongkosan; // Ongkosan = gross profit (total_amount - trip_allowance - gaji)
    if (ongkosan || trip_allowance || gaji) {
      // If ongkosan is not provided, calculate it based on trip allowance and gaji
      const tripAllowance = trip_allowance || deliveryOrder.trip_allowance || 0;
      const gaji = gaji || deliveryOrder.gaji || 0;

      if (calculateTotalAmount && tripAllowance && gaji) {
        calculatedOngkosan = calculateOngkosan(
          calculatedTotalAmount,
          tripAllowance,
          gaji
        );
      }
    }

    // ✅ Prepare update data
    const updateData = {
      purchase_order_id:
        purchase_order_id !== undefined
          ? purchase_order_id
          : deliveryOrder.purchase_order_id,
      vehicle_id:
        vehicle_id !== undefined ? vehicle_id : deliveryOrder.vehicle_id,
      driver_id: driver_id !== undefined ? driver_id : deliveryOrder.driver_id,
      customer_name:
        customer_name !== undefined
          ? customer_name
          : deliveryOrder.customer_name,
      item_name: item_name !== undefined ? item_name : deliveryOrder.item_name,
      minimal_load_quantity:
        minimal_load_quantity !== undefined
          ? minimal_load_quantity
          : deliveryOrder.minimal_load_quantity,
      unit: unit !== undefined ? unit : deliveryOrder.unit,
      unit_price:
        unit_price !== undefined ? unit_price : deliveryOrder.unit_price,
      total_amount:
        calculatedTotalAmount !== undefined
          ? calculatedTotalAmount
          : deliveryOrder.total_amount,
      trip_allowance:
        trip_allowance !== undefined
          ? trip_allowance
          : deliveryOrder.trip_allowance,
      gaji: gaji !== undefined ? gaji : deliveryOrder.gaji,
      ongkosan:
        calculatedOngkosan !== undefined ? ongkosan : deliveryOrder.ongkosan,
      load_location:
        load_location !== undefined
          ? load_location
          : deliveryOrder.load_location,
      unload_location:
        unload_location !== undefined
          ? unload_location
          : deliveryOrder.unload_location,
      load_latitude:
        load_latitude !== undefined
          ? load_latitude
          : deliveryOrder.load_latitude,
      load_longitude:
        load_longitude !== undefined
          ? load_longitude
          : deliveryOrder.load_longitude,
      unload_latitude:
        unload_latitude !== undefined
          ? unload_latitude
          : deliveryOrder.unload_latitude,
      unload_longitude:
        unload_longitude !== undefined
          ? unload_longitude
          : deliveryOrder.unload_longitude,
      payment_status:
        payment_status !== undefined
          ? payment_status
          : deliveryOrder.payment_status,
      status: status !== undefined ? status : deliveryOrder.status,
      do_name: do_name !== undefined ? do_name : deliveryOrder.do_name, // Include the new field
    };

    const updatedDO = await deliveryOrder.update(updateData);

    res.json({
      success: true,
      message: "Delivery Order updated successfully",
      data: {
        ...updatedDO.toJSON(),
        financial_summary: updatedDO.getFinancialSummary(),
      },
    });
  } catch (err) {
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
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
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

    // Update delivery order status
    await deliveryOrder.update(
      {
        status: "cancelled",
        notes: cancellation_reason || "Cancelled by admin",
      },
      { transaction }
    );

    // Free up vehicle
    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Delivery Order cancelled successfully",
    });
  } catch (err) {
    await transaction.rollback();
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

    const totalDriverCosts =
      parseFloat(totalTripAllowance) + parseFloat(totalGaji);
    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const netProfit = parseFloat(totalOngkosan) - totalDriverCosts;

    // Get unit distribution
    const unitStats = await DeliveryOrder.findAll({
      where: dateFilter,
      attributes: [
        "unit",
        [sequelize.fn("COUNT", "*"), "count"],
        [
          sequelize.fn("SUM", sequelize.col("minimal_load_quantity")),
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
        completion_rate: Math.round(completionRate * 100) / 100,
        total_revenue: parseFloat(totalRevenue),
        total_ongkosan: parseFloat(totalOngkosan),
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
    next(err);
  }
};
