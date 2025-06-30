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

// 🎯 NEW: Unit-aware calculation helper
const calculateTotalAmount = (quantity, unitPrice, unit) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
      return qty * price;
    case "ton":
      return qty * 1000 * price; // Convert ton to kg for pricing
    case "kubik":
      return qty * price; // Direct kubik pricing
    default:
      return qty * price;
  }
};

// Create delivery order with conflict prevention and ongkosan
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
      unit, // 🎯 NEW: Add unit field
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
      big_do_session_id,
      is_additional_do_for_session = false,
    } = req.body;

    // 🎯 ENHANCED: Driver/Vehicle availability check with Big DO session support
    if (!big_do_session_id) {
      // Normal DO creation - existing logic
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
    } else {
      // 🎯 NEW: Big DO session mode - validate session exists
      const sessionExists = await DeliveryOrder.findOne({
        where: { big_do_creation_session: big_do_session_id },
        transaction,
      });

      if (!sessionExists) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid Big DO creation session",
        });
      }

      // Validate same driver/vehicle as session
      if (
        sessionExists.driver_id !== driver_id ||
        sessionExists.vehicle_id !== vehicle_id
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Driver and vehicle must match the Big DO session",
        });
      }
    }

    // 🎯 ENHANCED: Validate required fields including unit
    if (!vehicle_id || !driver_id || !minimal_load_quantity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: vehicle_id, driver_id, minimal_load_quantity",
      });
    }

    // 🎯 NEW: Validate unit field
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // 🎯 NEW: Get unit from PO if not provided
    let finalUnit = unit;
    let finalUnitPrice = unit_price;

    if (purchase_order_id && (!finalUnit || !finalUnitPrice)) {
      const purchaseOrder = await PurchaseOrder.findByPk(purchase_order_id, {
        transaction,
      });
      if (purchaseOrder) {
        if (!finalUnit) {
          finalUnit = purchaseOrder.unit || "ton";
          console.log(`Unit inherited from PO: ${finalUnit}`);
        }
        if (!finalUnitPrice) {
          finalUnitPrice = purchaseOrder.unit_price;
          console.log(`Unit price inherited from PO: ${finalUnitPrice}`);
        }
      }
    }

    // Fallback to default unit if still not set
    if (!finalUnit) {
      finalUnit = "ton";
      console.warn('No unit specified, defaulting to "ton"');
    }

    // Check if driver is already assigned to an active delivery
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

    // Check if vehicle is already assigned to an active delivery
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

    // Generate unique DO number with timestamp and random suffix
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    let do_number = `DO-${timestamp}-${randomSuffix}`;

    // Ensure DO number is unique
    let attempts = 0;

    if (big_do_session_id) {
      // 🎯 NEW: Temporary DO number for session - will be renamed when Big DO is created
      const sessionDOCount = await DeliveryOrder.count({
        where: { big_do_creation_session: big_do_session_id },
        transaction,
      });
      do_number = `TEMP-${big_do_session_id}-${sessionDOCount + 1}`;
    } else {
      // Normal DO number generation
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      do_number = `DO-${timestamp}-${randomSuffix}`;

      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existingDO = await DeliveryOrder.findOne({
          where: { do_number },
          transaction,
        });

        if (!existingDO) break;

        attempts++;
        const newRandomSuffix = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        do_number = `DO-${timestamp}-${newRandomSuffix}`;
      }
    }

    // 🎯 ENHANCED: Calculate total amount with unit awareness
    let calculatedTotalAmount = total_amount;
    if (finalUnitPrice && minimal_load_quantity && finalUnit) {
      calculatedTotalAmount = calculateTotalAmount(
        minimal_load_quantity,
        finalUnitPrice,
        finalUnit
      );
      console.log(
        `Unit-aware calculation: ${minimal_load_quantity} ${finalUnit} × ${finalUnitPrice} = ${calculatedTotalAmount}`
      );
    }

    // 🎯 ENHANCED: Create delivery order with Big DO session fields
    const deliveryOrder = await DeliveryOrder.create(
      {
        purchase_order_id,
        driver_id,
        vehicle_id,
        do_number,
        customer_name,
        item_name,
        minimal_load_quantity,
        unit: finalUnit,
        unit_price: finalUnitPrice,
        total_amount: calculatedTotalAmount,
        trip_allowance: big_do_session_id ? 0 : trip_allowance, // Individual DOs in session get 0
        gaji,
        ongkosan,
        load_location,
        load_latitude,
        load_longitude,
        unload_location,
        unload_latitude,
        unload_longitude,
        payment_status,
        status: big_do_session_id ? "pending_big_do" : status,
        // 🎯 NEW: Big DO session fields
        big_do_creation_session: big_do_session_id,
        is_big_do_candidate: !!big_do_session_id,
        display_order: big_do_session_id
          ? await getNextDisplayOrder(big_do_session_id, transaction)
          : 0,
      },
      { transaction }
    );

    // Update vehicle status based on mode
    if (big_do_session_id) {
      await Vehicle.update(
        { status: "in_big_do_creation" },
        { where: { id: vehicle_id }, transaction }
      );
    } else {
      await Vehicle.update(
        { status: "in_use" },
        { where: { id: vehicle_id }, transaction }
      );
    }

    // === SEND PUSH NOTIFICATION TO DRIVER ===
    // Send push notification only for normal DOs (not session DOs)
    if (!big_do_session_id) {
      const driverUser = await User.findOne({
        where: { id: driver_id },
        attributes: ["username", "expo_push_token"],
        transaction,
      });

      const driverProfile = await DriverProfile.findOne({
        where: { user_id: driver_id },
        attributes: ["full_name"],
        transaction,
      });
      const driverName =
        driverProfile?.full_name || driverUser?.username || "Driver";

      if (driverUser && driverUser.expo_push_token) {
        const expo = new Expo();
        if (Expo.isExpoPushToken(driverUser.expo_push_token)) {
          const messages = [
            {
              to: driverUser.expo_push_token,
              sound: "default",
              title: "Tugas Pengantaran Baru",
              body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${deliveryOrder.do_number}. Silakan cek detail pengantaran di aplikasi.`,
              data: { do_number: deliveryOrder.do_number },
            },
          ];
          await expo.sendPushNotificationsAsync(messages);
        }
      }
    }
    await transaction.commit();

    // 🎯 ENHANCED: Return response with unit information
    res.status(201).json({
      success: true,
      message: big_do_session_id
        ? "Delivery order added to Big DO session"
        : "Delivery order created successfully",
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

// 🎯 NEW: Helper function to get next display order in session
async function getNextDisplayOrder(sessionId, transaction) {
  const lastDO = await DeliveryOrder.findOne({
    where: { big_do_creation_session: sessionId },
    order: [["display_order", "DESC"]],
    transaction,
  });

  return (lastDO?.display_order || 0) + 1;
}

// Get all DOs with enhanced web features
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
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (driver_id) {
      whereClause.driver_id = driver_id;
    }

    if (vehicle_id) {
      whereClause.vehicle_id = vehicle_id;
    }

    if (po_id) {
      whereClause.purchase_order_id = po_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { do_number: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // 🎯 NEW: Big DO filtering
    if (big_do_filter === "standalone") {
      whereClause.big_delivery_order_id = null;
      whereClause.big_do_creation_session = null;
    } else if (big_do_filter === "big_do_only") {
      whereClause.big_delivery_order_id = { [Op.not]: null };
    } else if (big_do_filter === "session_only") {
      whereClause.big_do_creation_session = { [Op.not]: null };
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
            ], // 🎯 NEW: Include unit from PO
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
            as: "bigDeliveryOrder",
            attributes: ["big_do_number", "status", "total_trip_allowance"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: offset,
      }
    );

    // 🎯 ENHANCED: Enhance data with computed fields and unit support
    const enhancedDOs = deliveryOrders.map((dOrder) => {
      const doData = dOrder.toJSON();

      // Ensure unit field exists with fallback
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
        unit: orderUnit, // Ensure unit is always present
        status_text: dOrder.getStatusText(),
        financial_summary: {
          ...dOrder.getFinancialSummary(),
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: dOrder.getUnitDisplay
            ? dOrder.getUnitDisplay()
            : orderUnit === "kilogram"
            ? "kg"
            : orderUnit === "ton"
            ? "ton"
            : orderUnit === "kubik"
            ? "m³"
            : orderUnit,
        },
        driver_name:
          doData.driver?.driverProfile?.full_name ||
          doData.driver?.username ||
          "N/A",
        vehicle_info:
          `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || "N/A",
        big_do_context: dOrder.getBigDOContext(),
        big_do_info: doData.bigDeliveryOrder
          ? {
              big_do_number: doData.bigDeliveryOrder.big_do_number,
              big_do_status: doData.bigDeliveryOrder.status,
              total_trip_allowance:
                doData.bigDeliveryOrder.total_trip_allowance,
            }
          : null,
      };
    });

    // 🎯 ENHANCED: Calculate summary stats with unit awareness
    // Enhanced stats with Big DO breakdown
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
      pending_big_do: enhancedDOs.filter((d) => d.status === "pending_big_do")
        .length,
      total_revenue: enhancedDOs.reduce(
        (sum, d) => sum + (parseFloat(d.total_amount) || 0),
        0
      ),
      total_ongkosan: enhancedDOs.reduce(
        (sum, d) => sum + (parseFloat(d.ongkosan) || 0),
        0
      ),
      total_driver_costs: enhancedDOs.reduce(
        (sum, d) =>
          sum + (parseFloat(d.trip_allowance) || 0) + (parseFloat(d.gaji) || 0),
        0
      ),
      // 🎯 NEW: Big DO breakdown
      big_do_breakdown: {
        standalone_dos: enhancedDOs.filter(
          (d) => !d.big_delivery_order_id && !d.big_do_creation_session
        ).length,
        big_do_members: enhancedDOs.filter((d) => d.big_delivery_order_id)
          .length,
        session_candidates: enhancedDOs.filter((d) => d.big_do_creation_session)
          .length,
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

// Get DO by ID with detailed info
// 🎯 ENHANCED: Get DO by ID with Big DO context
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
        // 🎯 NEW: Include Big DO data
        {
          model: BigDeliveryOrder,
          as: "bigDeliveryOrder",
          include: [
            {
              model: DeliveryOrder,
              as: "deliveryOrders",
              attributes: ["id", "do_number", "customer_name", "status"],
              where: { id: { [Op.not]: id } }, // Exclude current DO
              required: false,
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
        unit_price: doData.unit_price,
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
        // 🎯 NEW: Big DO context
        big_do_context: deliveryOrder.getBigDOContext(),
        big_do_info: doData.bigDeliveryOrder
          ? {
              big_do_number: doData.bigDeliveryOrder.big_do_number,
              big_do_status: doData.bigDeliveryOrder.status,
              sibling_dos: doData.bigDeliveryOrder.deliveryOrders || [],
              total_dos_in_big_do:
                (doData.bigDeliveryOrder.deliveryOrders?.length || 0) + 1,
            }
          : null,
        // 🎯 NEW: Session info if in session
        session_info: doData.big_do_creation_session
          ? {
              session_id: doData.big_do_creation_session,
              can_add_more: true,
              can_finalize: true,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 🎯 NEW: Update DO display order in Big DO session
exports.updateDODisplayOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { session_id } = req.params;
    const { delivery_orders_with_order } = req.body; // [{ id: 1, display_order: 1 }, ...]

    // Validate session exists
    const sessionDOs = await DeliveryOrder.findAll({
      where: { big_do_creation_session: session_id },
      transaction,
    });

    if (sessionDOs.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big DO session not found",
      });
    }

    // Update display orders
    for (const doInfo of delivery_orders_with_order) {
      await DeliveryOrder.update(
        { display_order: doInfo.display_order },
        {
          where: {
            id: doInfo.id,
            big_do_creation_session: session_id,
          },
          transaction,
        }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Display order updated successfully",
      data: {
        updated_count: delivery_orders_with_order.length,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// Update DO (admin only)
exports.updateDeliveryOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id);

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    // 🎯 NEW: Validate unit if being updated
    if (
      updateData.unit &&
      !["kilogram", "ton", "kubik"].includes(updateData.unit)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // 🎯 NEW: Recalculate total_amount if quantity, unit_price, or unit changes
    if (
      updateData.minimal_load_quantity ||
      updateData.unit_price ||
      updateData.unit
    ) {
      const quantity =
        updateData.minimal_load_quantity || deliveryOrder.minimal_load_quantity;
      const unitPrice = updateData.unit_price || deliveryOrder.unit_price;
      const unit = updateData.unit || deliveryOrder.unit || "ton";

      if (quantity && unitPrice && unit) {
        updateData.total_amount = calculateTotalAmount(
          quantity,
          unitPrice,
          unit
        );
        console.log(
          `Recalculated total_amount: ${updateData.total_amount} for unit: ${unit}`
        );
      }
    }

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

// Cancel DO
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

    // Update delivery order status
    await deliveryOrder.update(
      {
        status: "cancelled",
        notes: cancellation_reason || "Cancelled by admin",
      },
      { transaction }
    );

    // Free up vehicle and driver
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

// 🎯 ENHANCED: Get delivery statistics with unit awareness
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
      totalDriverCosts,
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
      }) ||
        0 +
          DeliveryOrder.sum("gaji", {
            where: { ...dateFilter, status: "completed" },
          }) ||
        0,
    ]);

    // 🎯 NEW: Get unit distribution statistics
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

    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const netProfit = parseFloat(totalOngkosan) - parseFloat(totalDriverCosts);

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
        total_driver_costs: parseFloat(totalDriverCosts),
        net_profit: netProfit,
        // 🎯 NEW: Unit distribution statistics
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
