// src/controllers/web/bigDeliveryOrder.controller.js
const {
  BigDeliveryOrder,
  BigDoTambahan,
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverProfile,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");

// Helper: Calculate tambahan total amount with unit awareness
const calculateTambahanAmount = (quantity, unit, unitPrice) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
    case "ton":
    case "kubik":
      return qty * price;
    default:
      return 0;
  }
};

// Helper: Calculate proper Big DO financial summary
const calculateBigDOFinancials = (
  mainDO,
  tambahan,
  totalTripAllowance,
  totalGaji
) => {
  // Revenue: Main DO + all tambahan amounts
  const mainRevenue = parseFloat(mainDO.total_amount) || 0;
  const tambahanRevenue = tambahan.reduce((sum, item) => {
    return (
      sum + calculateTambahanAmount(item.quantity, item.unit, item.unit_price)
    );
  }, 0);
  const totalRevenue = mainRevenue + tambahanRevenue;

  // Costs: Shared allowance + gaji
  const totalCosts =
    (parseFloat(totalTripAllowance) || 0) + (parseFloat(totalGaji) || 0);

  // Profit (ongkosan): Revenue - Costs
  const totalOngkosan = totalRevenue - totalCosts;

  return {
    totalRevenue,
    totalCosts,
    totalOngkosan,
    tambahanRevenue,
  };
};

/**
 * 🎯 GET ALL BIG DELIVERY ORDERS
 * GET /api/web/big-delivery-orders
 */
exports.getAllBigDeliveryOrders = async (req, res, next) => {
  try {
    const { status, driver_id, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (driver_id) whereClause.driver_id = driver_id;
    if (search) {
      whereClause[Op.or] = [
        { big_do_number: { [Op.iLike]: `%${search}%` } },
        { "$mainDeliveryOrder.customer_name$": { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: bigDOs } = await BigDeliveryOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DeliveryOrder,
          as: "mainDeliveryOrder",
          include: [
            {
              model: PurchaseOrder,
              as: "purchaseOrder",
              attributes: ["po_number", "customer_name", "item_name"],
            },
          ],
        },
        {
          model: User,
          as: "driver",
          attributes: ["username"],
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
          attributes: ["license_plate", "type"],
        },
        {
          model: BigDoTambahan,
          as: "tambahan",
          attributes: ["id", "customer_name", "total_amount", "status"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Enhance data with computed fields
    const enhancedBigDOs = bigDOs.map((bigDO) => ({
      ...bigDO.toJSON(),
      driver_name:
        bigDO.driver?.driverProfile?.full_name || bigDO.driver?.username,
      vehicle_info: `${bigDO.vehicle?.license_plate} (${bigDO.vehicle?.type})`,
      status_text: bigDO.getStatusText(),
      financial_summary: bigDO.getFinancialSummary(),
      quantity_summary: bigDO.getTotalQuantity(),
      delivery_progress: bigDO.getDeliveryProgress(),
      delivery_summary: {
        main_do: {
          customer: bigDO.mainDeliveryOrder?.customer_name,
          po_number: bigDO.mainDeliveryOrder?.purchaseOrder?.po_number,
          status: bigDO.mainDeliveryOrder?.status,
        },
        tambahan_count: bigDO.tambahan?.length || 0,
        tambahan_completed:
          bigDO.tambahan?.filter((t) => t.status === "delivered").length || 0,
      },
    }));

    // Calculate summary stats
    const stats = {
      total: count,
      assigned: enhancedBigDOs.filter((b) => b.status === "assigned").length,
      in_progress: enhancedBigDOs.filter((b) => b.status === "in_progress")
        .length,
      completed: enhancedBigDOs.filter((b) => b.status === "completed").length,
      cancelled: enhancedBigDOs.filter((b) => b.status === "cancelled").length,
      total_revenue: enhancedBigDOs.reduce(
        (sum, b) => sum + (b.financial_summary?.total_revenue || 0),
        0
      ),
      total_ongkosan: enhancedBigDOs.reduce(
        (sum, b) => sum + (b.financial_summary?.total_ongkosan || 0),
        0
      ),
    };

    res.json({
      success: true,
      data: enhancedBigDOs,
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
 * 🎯 GET AVAILABLE DELIVERY ORDERS FOR BIG DO CREATION
 * GET /api/web/big-delivery-orders/available-dos
 */
exports.getAvailableDeliveryOrders = async (req, res, next) => {
  try {
    const availableDOs = await DeliveryOrder.findAll({
      where: {
        status: "assigned",
        // Exclude DOs that are already main DOs in other Big DOs
        id: {
          [Op.notIn]: sequelize.literal(
            "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
          ),
        },
      },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number", "customer_name", "item_name"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["username"],
          include: [
            {
              model: DriverProfile,
              as: "driverProfile",
              attributes: ["full_name"],
            },
          ],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["license_plate", "type"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Enhance with computed fields
    const enhancedDOs = availableDOs.map((doItem) => ({
      ...doItem.toJSON(),
      driver_name:
        doItem.driver?.driverProfile?.full_name || doItem.driver?.username,
      vehicle_info: `${doItem.vehicle?.license_plate} (${doItem.vehicle?.type})`,
      financial_summary: doItem.getFinancialSummary(),
      unit_display: doItem.getUnitDisplay(),
    }));

    res.json({
      success: true,
      data: enhancedDOs,
      total: enhancedDOs.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🎯 CREATE BIG DELIVERY ORDER (Fixed Financial Logic)
 * POST /api/web/big-delivery-orders
 */

// Helper: Extracted single Big DO creation logic (refactored from your single create)
async function createSingleBigDO(bigDOData, user, transaction) {
  const {
    main_delivery_order_id,
    total_trip_allowance,
    total_gaji,
    tambahan = [],
    notes,
  } = bigDOData;

  // Validate tambahan array
  if (!Array.isArray(tambahan) || tambahan.length === 0) {
    throw new Error("At least one tambahan delivery is required for Big DO");
  }

  // Validate tambahan items
  for (const [index, item] of tambahan.entries()) {
    const requiredFields = [
      "customer_name",
      "item_name",
      "quantity",
      "unit",
      "unit_price",
      "pickup_location",
      "delivery_location",
    ];
    for (const field of requiredFields) {
      if (!item[field]) {
        throw new Error(`Tambahan ${index + 1}: ${field} is required`);
      }
    }

    // Validate quantity and price
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.unit_price);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Tambahan ${index + 1}: Invalid quantity`);
    }
    if (isNaN(price) || price < 0) {
      throw new Error(`Tambahan ${index + 1}: Invalid unit price`);
    }
  }

  // Validate main DO
  const mainDO = await DeliveryOrder.findByPk(main_delivery_order_id, {
    transaction,
  });
  if (!mainDO) {
    throw new Error("Main Delivery Order not found");
  }

  if (mainDO.status !== "assigned") {
    throw new Error("Main Delivery Order must be in assigned status");
  }

  // Check if main DO is already used in another Big DO
  const existingBigDO = await BigDeliveryOrder.findOne({
    where: {
      main_delivery_order_id,
      status: { [Op.ne]: "cancelled" },
    },
    transaction,
  });

  if (existingBigDO) {
    throw new Error("This Delivery Order is already used in another Big DO");
  }

  // Generate Big DO number
  const bigDoNumber = await BigDeliveryOrder.generateBigDONumber();

  // Calculate proper financials
  const financials = calculateBigDOFinancials(
    mainDO,
    tambahan,
    total_trip_allowance,
    total_gaji
  );

  // Create Big DO with corrected calculations
  const bigDO = await BigDeliveryOrder.create(
    {
      big_do_number: bigDoNumber,
      main_delivery_order_id,
      driver_id: mainDO.driver_id,
      vehicle_id: mainDO.vehicle_id,
      total_trip_allowance: parseFloat(total_trip_allowance) || 0,
      total_gaji: parseFloat(total_gaji) || 0, // Just the additional gaji for Big DO
      total_ongkosan: financials.totalOngkosan, // FIXED: Proper profit calculation
      status: "assigned",
      notes,
      created_by: user.id, // Passed from req.user
    },
    { transaction }
  );

  // Create tambahan deliveries
  const createdTambahan = [];
  for (const item of tambahan) {
    const tambahanNumber = await BigDoTambahan.generateTambahanNumber(bigDO.id);

    const tambahanItem = await BigDoTambahan.create(
      {
        big_delivery_order_id: bigDO.id,
        tambahan_number: tambahanNumber,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_address: item.customer_address,
        item_name: item.item_name,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unit_price: parseFloat(item.unit_price),
        total_amount: calculateTambahanAmount(
          item.quantity,
          item.unit,
          item.unit_price
        ),
        pickup_location: item.pickup_location,
        pickup_latitude: item.pickup_latitude
          ? parseFloat(item.pickup_latitude)
          : null,
        pickup_longitude: item.pickup_longitude
          ? parseFloat(item.pickup_longitude)
          : null,
        delivery_location: item.delivery_location,
        delivery_latitude: item.delivery_latitude
          ? parseFloat(item.delivery_latitude)
          : null,
        delivery_longitude: item.delivery_longitude
          ? parseFloat(item.delivery_longitude)
          : null,
        notes: item.notes,
      },
      { transaction }
    );

    createdTambahan.push(tambahanItem);
  }

  // Send push notification to driver
  const driverUser = await User.findOne({
    where: { id: mainDO.driver_id },
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
          title: "Big DO Assignment Baru",
          body: `Halo ${driverName}, Anda telah ditugaskan Big DO ${bigDO.big_do_number} dengan ${createdTambahan.length} tambahan pengiriman. Silakan cek detail di aplikasi.`,
          data: {
            big_do_number: bigDO.big_do_number,
            type: "big_do_assignment",
          },
        },
      ];

      try {
        await expo.sendPushNotificationsAsync(messages);
      } catch (pushError) {
        console.error("Push notification error:", pushError);
      }
    }
  }

  // Fetch complete Big DO data for response (optional, but your code has it)
  const completeBigDO = await BigDeliveryOrder.findByPk(bigDO.id, {
    include: [
      {
        model: DeliveryOrder,
        as: "mainDeliveryOrder",
        include: [
          {
            model: PurchaseOrder,
            as: "purchaseOrder",
          },
        ],
      },
      {
        model: User,
        as: "driver",
        attributes: ["username"],
        include: [
          {
            model: DriverProfile,
            as: "driverProfile",
            attributes: ["full_name"],
          },
        ],
      },
      {
        model: Vehicle,
        as: "vehicle",
      },
      {
        model: BigDoTambahan,
        as: "tambahan",
      },
    ],
    transaction,
  });

  return {
    ...completeBigDO.toJSON(),
    financial_summary: {
      main_do_revenue: parseFloat(mainDO.total_amount),
      tambahan_total_revenue: financials.tambahanRevenue,
      total_revenue: financials.totalRevenue,
      total_trip_allowance: parseFloat(total_trip_allowance) || 0,
      total_gaji: parseFloat(total_gaji) || 0,
      total_costs: financials.totalCosts,
      total_ongkosan: financials.totalOngkosan,
      net_profit: financials.totalOngkosan,
    },
    quantity_summary: completeBigDO.getTotalQuantity?.() || null,
    driver_name: driverUser?.driverProfile?.full_name || driverUser?.username,
  };
}

// Your existing single create endpoint, now using the helper
exports.createBigDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const created = await createSingleBigDO(req.body, req.user, transaction);
    await transaction.commit();
    res.status(201).json({
      success: true,
      data: created,
      message:
        "Big Delivery Order created successfully with proper financial calculations",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// NEW: Batch create endpoint
// endpoint route: /api/web/big-delivery-orders/batch
exports.createBigDeliveryOrderBatch = async (req, res, next) => {
  const { big_delivery_orders = [] } = req.body;
  if (!Array.isArray(big_delivery_orders) || big_delivery_orders.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No Big DOs provided for batch creation",
    });
  }

  const transaction = await sequelize.transaction();
  try {
    const results = [];
    for (const bigDOData of big_delivery_orders) {
      const created = await createSingleBigDO(bigDOData, req.user, transaction);
      results.push(created);
    }
    await transaction.commit();
    res.status(201).json({
      success: true,
      data: results,
      message: `Batch created: ${results.length} Big DO(s) successfully`,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 GET BIG DO BY ID
 * GET /api/web/big-delivery-orders/:id
 */
exports.getBigDeliveryOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bigDO = await BigDeliveryOrder.findByPk(id, {
      include: [
        {
          model: DeliveryOrder,
          as: "mainDeliveryOrder",
          include: [
            {
              model: PurchaseOrder,
              as: "purchaseOrder",
            },
          ],
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
          model: BigDoTambahan,
          as: "tambahan",
          order: [["created_at", "ASC"]],
        },
      ],
    });

    if (!bigDO) {
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    // Enhance data with computed fields
    const enhancedBigDO = {
      ...bigDO.toJSON(),
      driver_name:
        bigDO.driver?.driverProfile?.full_name || bigDO.driver?.username,
      vehicle_info: `${bigDO.vehicle?.license_plate} (${bigDO.vehicle?.type})`,
      status_text: bigDO.getStatusText(),
      financial_summary: bigDO.getFinancialSummary(),
      quantity_summary: bigDO.getTotalQuantity(),
      delivery_progress: bigDO.getDeliveryProgress(),
      tambahan:
        bigDO.tambahan?.map((t) => ({
          ...t.toJSON(),
          status_text: t.getStatusText(),
          financial_summary: t.getFinancialSummary(),
          unit_display: t.getUnitDisplay(),
        })) || [],
    };

    res.json({
      success: true,
      data: enhancedBigDO,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🎯 UPDATE BIG DO STATUS
 * PATCH /api/web/big-delivery-orders/:id/status
 */
exports.updateBigDeliveryOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const bigDO = await BigDeliveryOrder.findByPk(id, { transaction });
    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    // Validate status transition
    const validStatuses = ["assigned", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Update Big DO status
    await bigDO.update(
      {
        status,
        notes: notes ? `${bigDO.notes || ""}\n${notes}`.trim() : bigDO.notes,
        started_at:
          status === "in_progress" && !bigDO.started_at
            ? new Date()
            : bigDO.started_at,
        completed_at: status === "completed" ? new Date() : bigDO.completed_at,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      data: {
        ...bigDO.toJSON(),
        status_text: bigDO.getStatusText(),
      },
      message: "Big Delivery Order status updated successfully",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 CANCEL BIG DELIVERY ORDER
 * PATCH /api/web/big-delivery-orders/:id/cancel
 */
exports.cancelBigDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const bigDO = await BigDeliveryOrder.findByPk(id, {
      include: [
        {
          model: BigDoTambahan,
          as: "tambahan",
        },
      ],
      transaction,
    });

    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    if (!bigDO.canCancel()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Big DO cannot be cancelled in current status",
      });
    }

    // Cancel Big DO
    await bigDO.update(
      {
        status: "cancelled",
        cancellation_reason: cancellation_reason || "Cancelled by admin",
      },
      { transaction }
    );

    // Cancel all tambahan
    if (bigDO.tambahan && bigDO.tambahan.length > 0) {
      for (const tambahan of bigDO.tambahan) {
        await tambahan.update(
          {
            status: "cancelled",
            notes: `Cancelled due to Big DO cancellation: ${
              cancellation_reason || "Admin cancelled"
            }`,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Big Delivery Order cancelled successfully",
      data: {
        cancelled_tambahan: bigDO.tambahan?.length || 0,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 ADD TAMBAHAN TO EXISTING BIG DO
 * POST /api/web/big-delivery-orders/:id/tambahan
 */
exports.addTambahanToBigDO = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const tambahanData = req.body;

    const bigDO = await BigDeliveryOrder.findByPk(id, { transaction });
    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    if (bigDO.status !== "assigned") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot add tambahan to Big DO that is not in assigned status",
      });
    }

    // Generate tambahan number
    const tambahanNumber = await BigDoTambahan.generateTambahanNumber(bigDO.id);

    // Create tambahan
    const tambahan = await BigDoTambahan.create(
      {
        big_delivery_order_id: bigDO.id,
        tambahan_number: tambahanNumber,
        customer_name: tambahanData.customer_name,
        customer_phone: tambahanData.customer_phone,
        customer_address: tambahanData.customer_address,
        item_name: tambahanData.item_name,
        quantity: tambahanData.quantity,
        unit: tambahanData.unit,
        unit_price: tambahanData.unit_price,
        total_amount: calculateTambahanAmount(
          tambahanData.quantity,
          tambahanData.unit,
          tambahanData.unit_price
        ),
        pickup_location: tambahanData.pickup_location,
        pickup_latitude: tambahanData.pickup_latitude,
        pickup_longitude: tambahanData.pickup_longitude,
        delivery_location: tambahanData.delivery_location,
        delivery_latitude: tambahanData.delivery_latitude,
        delivery_longitude: tambahanData.delivery_longitude,
        notes: tambahanData.notes,
      },
      { transaction }
    );

    // Update Big DO total amounts
    await bigDO.update(
      {
        total_ongkosan:
          parseFloat(bigDO.total_ongkosan) + parseFloat(tambahan.total_amount),
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        ...tambahan.toJSON(),
        financial_summary: tambahan.getFinancialSummary(),
      },
      message: "Tambahan added successfully",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 UPDATE TAMBAHAN
 * PUT /api/web/big-delivery-orders/:id/tambahan/:tambahanId
 */
exports.updateTambahan = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id, tambahanId } = req.params;
    const updateData = req.body;

    // Validate Big DO exists and is editable
    const bigDO = await BigDeliveryOrder.findByPk(id, { transaction });
    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    if (bigDO.status !== "assigned") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot update tambahan when Big DO is not in assigned status",
      });
    }

    // Find and update tambahan
    const tambahan = await BigDoTambahan.findOne({
      where: {
        id: tambahanId,
        big_delivery_order_id: id,
      },
      transaction,
    });

    if (!tambahan) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Tambahan not found",
      });
    }

    // Recalculate total_amount if quantity, unit, or unit_price changes
    if (updateData.quantity || updateData.unit || updateData.unit_price) {
      const quantity = updateData.quantity || tambahan.quantity;
      const unit = updateData.unit || tambahan.unit;
      const unitPrice = updateData.unit_price || tambahan.unit_price;

      updateData.total_amount = calculateTambahanAmount(
        quantity,
        unit,
        unitPrice
      );
    }

    const updatedTambahan = await tambahan.update(updateData, { transaction });

    // Update Big DO total if amount changed
    if (updateData.total_amount) {
      const totalTambahanAmount = await BigDoTambahan.sum("total_amount", {
        where: { big_delivery_order_id: id },
        transaction,
      });

      const mainDO = await DeliveryOrder.findByPk(
        bigDO.main_delivery_order_id,
        { transaction }
      );
      const newTotalOngkosan =
        (parseFloat(mainDO.ongkosan) || 0) + (totalTambahanAmount || 0);

      await bigDO.update(
        {
          total_ongkosan: newTotalOngkosan,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        ...updatedTambahan.toJSON(),
        financial_summary: updatedTambahan.getFinancialSummary(),
      },
      message: "Tambahan updated successfully",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 UPDATE TAMBAHAN STATUS
 * PATCH /api/web/big-delivery-orders/:id/tambahan/:tambahanId/status
 */
exports.updateTambahanStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id, tambahanId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "assigned",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const tambahan = await BigDoTambahan.findOne({
      where: {
        id: tambahanId,
        big_delivery_order_id: id,
      },
      transaction,
    });

    if (!tambahan) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Tambahan not found",
      });
    }

    // Update status with timestamps
    const updateData = {
      status,
      notes: notes
        ? `${tambahan.notes || ""}\n${notes}`.trim()
        : tambahan.notes,
    };

    if (status === "picked_up" && !tambahan.picked_up_at) {
      updateData.picked_up_at = new Date();
    }
    if (status === "delivered") {
      updateData.delivered_at = new Date();
    }

    await tambahan.update(updateData, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: {
        ...tambahan.toJSON(),
        status_text: tambahan.getStatusText(),
      },
      message: "Tambahan status updated successfully",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 DELETE TAMBAHAN
 * DELETE /api/web/big-delivery-orders/:id/tambahan/:tambahanId
 */
exports.deleteTambahan = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id, tambahanId } = req.params;

    const bigDO = await BigDeliveryOrder.findByPk(id, { transaction });
    if (!bigDO || bigDO.status !== "assigned") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot delete tambahan when Big DO is not in assigned status",
      });
    }

    const tambahan = await BigDoTambahan.findOne({
      where: {
        id: tambahanId,
        big_delivery_order_id: id,
      },
      transaction,
    });

    if (!tambahan) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Tambahan not found",
      });
    }

    const tambahanAmount = parseFloat(tambahan.total_amount) || 0;

    // Delete tambahan
    await tambahan.destroy({ transaction });

    // Update Big DO total
    await bigDO.update(
      {
        total_ongkosan: parseFloat(bigDO.total_ongkosan) - tambahanAmount,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Tambahan deleted successfully",
      data: {
        deleted_amount: tambahanAmount,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 GET TAMBAHAN BY ID
 * GET /api/web/big-delivery-orders/:id/tambahan/:tambahanId
 */
exports.getTambahanById = async (req, res, next) => {
  try {
    const { id, tambahanId } = req.params;

    const tambahan = await BigDoTambahan.findOne({
      where: {
        id: tambahanId,
        big_delivery_order_id: id,
      },
      include: [
        {
          model: BigDeliveryOrder,
          as: "bigDeliveryOrder",
          attributes: ["big_do_number", "status"],
        },
      ],
    });

    if (!tambahan) {
      return res.status(404).json({
        success: false,
        message: "Tambahan not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...tambahan.toJSON(),
        status_text: tambahan.getStatusText(),
        financial_summary: tambahan.getFinancialSummary(),
        unit_display: tambahan.getUnitDisplay(),
      },
    });
  } catch (err) {
    next(err);
  }
};
