// src/controllers/web/bigDeliveryOrderController.js
const {
  BigDeliveryOrder,
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverProfile,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");

/**
 * 🎯 INITIALIZE BIG DO CREATION SESSION
 * POST /api/web/delivery-orders/initialize-big-do
 */
exports.initializeBigDOSession = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { first_do_id } = req.body;

    // Validate first DO
    const firstDO = await DeliveryOrder.findByPk(first_do_id, { transaction });
    if (!firstDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    if (firstDO.status !== "assigned" || firstDO.big_delivery_order_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "DO is not available for Big DO creation",
      });
    }

    // Generate session ID
    const sessionId = `BigDO-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Update first DO with session
    await firstDO.update(
      {
        big_do_creation_session: sessionId,
        is_big_do_candidate: true,
        status: "pending_big_do",
      },
      { transaction }
    );

    // Update vehicle status
    await Vehicle.update(
      { status: "in_big_do_creation" },
      { where: { id: firstDO.vehicle_id }, transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Big DO creation session initialized",
      data: {
        session_id: sessionId,
        driver_id: firstDO.driver_id,
        vehicle_id: firstDO.vehicle_id,
        first_do: {
          id: firstDO.id,
          do_number: firstDO.do_number,
          customer_name: firstDO.customer_name,
        },
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 GET BIG DO SESSION DATA
 * GET /api/web/delivery-orders/big-do-session/:sessionId
 */
exports.getBigDOSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const sessionDOs = await DeliveryOrder.findAll({
      where: { big_do_creation_session: sessionId },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number", "customer_name", "unit"],
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
      order: [
        ["display_order", "ASC"],
        ["created_at", "ASC"],
      ],
    });

    if (sessionDOs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Big DO session not found or expired",
      });
    }

    // Enhance data with computed fields
    const enhancedDOs = sessionDOs.map((dOrder) => ({
      ...dOrder.toJSON(),
      driver_name:
        dOrder.driver?.driverProfile?.full_name || dOrder.driver?.username,
      vehicle_info: `${dOrder.vehicle?.license_plate} (${dOrder.vehicle?.type})`,
      unit_display: dOrder.getUnitDisplay(),
      financial_summary: dOrder.getFinancialSummary(),
    }));

    // Calculate session totals
    const sessionTotals = {
      total_dos: enhancedDOs.length,
      total_gaji: enhancedDOs.reduce(
        (sum, dOrder) => sum + (parseFloat(dOrder.gaji) || 0),
        0
      ),
      total_ongkosan: enhancedDOs.reduce(
        (sum, dOrder) => sum + (parseFloat(dOrder.ongkosan) || 0),
        0
      ),
      total_revenue: enhancedDOs.reduce(
        (sum, dOrder) => sum + (parseFloat(dOrder.total_amount) || 0),
        0
      ),
    };

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        delivery_orders: enhancedDOs,
        session_totals: sessionTotals,
        driver_info: enhancedDOs[0]?.driver_name,
        vehicle_info: enhancedDOs[0]?.vehicle_info,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🎯 CREATE BIG DELIVERY ORDER
 * POST /api/web/big-delivery-orders
 */
exports.createBigDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { session_id, trip_allowance, notes } = req.body;

    // Get all DOs in session
    const sessionDOs = await DeliveryOrder.findAll({
      where: {
        big_do_creation_session: session_id,
        status: "pending_big_do",
      },
      transaction,
    });

    if (sessionDOs.length < 2) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Big DO requires at least 2 delivery orders",
      });
    }

    // Generate Big DO number
    const bigDONumber = await BigDeliveryOrder.generateBigDONumber();

    // Calculate totals
    const totalGaji = sessionDOs.reduce(
      (sum, dOrder) => sum + parseFloat(dOrder.gaji),
      0
    );
    const totalOngkosan = sessionDOs.reduce(
      (sum, dOrder) => sum + parseFloat(dOrder.ongkosan || 0),
      0
    );

    // Create Big DO
    const bigDO = await BigDeliveryOrder.create(
      {
        big_do_number: bigDONumber,
        driver_id: sessionDOs[0].driver_id,
        vehicle_id: sessionDOs[0].vehicle_id,
        total_trip_allowance: parseFloat(trip_allowance) || 0,
        total_gaji: totalGaji,
        total_ongkosan: totalOngkosan,
        status: "assigned",
        notes,
      },
      { transaction }
    );

    // Update individual DOs
    for (let i = 0; i < sessionDOs.length; i++) {
      const dOrder = sessionDOs[i];
      const newDONumber = `DO-BigDO${
        bigDONumber.split("-")[1]
      }-${String.fromCharCode(65 + i)}`;

      await dOrder.update(
        {
          big_delivery_order_id: bigDO.id,
          do_number: newDONumber,
          display_order: i + 1,
          trip_allowance: 0, // Individual DOs get 0, Big DO gets the total
          status: "assigned",
          big_do_creation_session: null,
          is_big_do_candidate: false,
        },
        { transaction }
      );
    }

    // Update vehicle status
    await Vehicle.update(
      { status: "in_use" },
      { where: { id: sessionDOs[0].vehicle_id }, transaction }
    );

    // Send push notification to driver
    const driverUser = await User.findOne({
      where: { id: sessionDOs[0].driver_id },
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
            body: `Halo ${driverName}, Anda telah ditugaskan Big DO ${bigDO.big_do_number} dengan ${sessionDOs.length} pengiriman. Silakan cek detail di aplikasi.`,
            data: {
              big_do_number: bigDO.big_do_number,
              type: "big_do_assignment",
            },
          },
        ];
        await expo.sendPushNotificationsAsync(messages);
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Big Delivery Order created successfully",
      data: {
        big_do: {
          ...bigDO.toJSON(),
          financial_summary: bigDO.getFinancialSummary(),
        },
        individual_dos: sessionDOs.length,
        driver_name:
          driverUser?.driverProfile?.full_name || driverUser?.username,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 GET ALL BIG DELIVERY ORDERS
 * GET /api/web/big-delivery-orders
 */
exports.getAllBigDeliveryOrders = async (req, res, next) => {
  try {
    const { status, driver_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (driver_id) whereClause.driver_id = driver_id;

    const { count, rows: bigDOs } = await BigDeliveryOrder.findAndCountAll({
      where: whereClause,
      include: [
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
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          include: [
            {
              model: PurchaseOrder,
              as: "purchaseOrder",
              attributes: ["po_number", "customer_name"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    // Enhance data
    const enhancedBigDOs = bigDOs.map((bigDO) => ({
      ...bigDO.toJSON(),
      driver_name:
        bigDO.driver?.driverProfile?.full_name || bigDO.driver?.username,
      vehicle_info: `${bigDO.vehicle?.license_plate} (${bigDO.vehicle?.type})`,
      status_text: bigDO.getStatusText(),
      financial_summary: bigDO.getFinancialSummary(),
      delivery_summary: {
        total_dos: bigDO.deliveryOrders?.length || 0,
        completed_dos:
          bigDO.deliveryOrders?.filter(
            (dOrder) => dOrder.status === "completed"
          ).length || 0,
        customers: [
          ...new Set(
            bigDO.deliveryOrders?.map((dOrder) => dOrder.customer_name) || []
          ),
        ],
        po_numbers: [
          ...new Set(
            bigDO.deliveryOrders
              ?.map((dOrder) => dOrder.purchaseOrder?.po_number)
              .filter(Boolean) || []
          ),
        ],
      },
    }));

    res.json({
      success: true,
      data: enhancedBigDOs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
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
          model: User,
          as: "driver",
          include: [{ model: DriverProfile, as: "driverProfile" }],
        },
        {
          model: Vehicle,
          as: "vehicle",
        },
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          include: [{ model: PurchaseOrder, as: "purchaseOrder" }],
          order: [["display_order", "ASC"]],
        },
      ],
    });

    if (!bigDO) {
      return res.status(404).json({
        success: false,
        message: "Big Delivery Order not found",
      });
    }

    // Enhance data
    const enhancedBigDO = {
      ...bigDO.toJSON(),
      driver_name:
        bigDO.driver?.driverProfile?.full_name || bigDO.driver?.username,
      vehicle_info: `${bigDO.vehicle?.license_plate} (${bigDO.vehicle?.type})`,
      status_text: bigDO.getStatusText(),
      financial_summary: bigDO.getFinancialSummary(),
      deliveryOrders: bigDO.deliveryOrders.map((dOrder) => ({
        ...dOrder.toJSON(),
        unit_display: dOrder.getUnitDisplay(),
        status_text: dOrder.getStatusText(),
        financial_summary: dOrder.getFinancialSummary(),
      })),
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
 * 🎯 CANCEL BIG DO SESSION
 * DELETE /api/web/delivery-orders/big-do-session/:sessionId
 */
exports.cancelBigDOSession = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { sessionId } = req.params;

    const sessionDOs = await DeliveryOrder.findAll({
      where: { big_do_creation_session: sessionId },
      transaction,
    });

    if (sessionDOs.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big DO session not found",
      });
    }

    // Reset all DOs in session
    for (const dOrder of sessionDOs) {
      await dOrder.update(
        {
          big_do_creation_session: null,
          is_big_do_candidate: false,
          status: "assigned",
        },
        { transaction }
      );
    }

    // Reset vehicle status
    if (sessionDOs[0]) {
      await Vehicle.update(
        { status: "in_use" },
        { where: { id: sessionDOs[0].vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Big DO session cancelled successfully",
      data: {
        cancelled_dos: sessionDOs.length,
      },
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
      include: [{ model: DeliveryOrder, as: "deliveryOrders" }],
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

    // Cancel all individual DOs
    for (const dOrder of bigDO.deliveryOrders) {
      await dOrder.update(
        {
          status: "cancelled",
          notes: `Cancelled due to Big DO cancellation: ${
            cancellation_reason || "Admin cancelled"
          }`,
        },
        { transaction }
      );
    }

    // Free up vehicle
    await Vehicle.update(
      { status: "available" },
      { where: { id: bigDO.vehicle_id }, transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Big Delivery Order cancelled successfully",
      data: {
        cancelled_dos: bigDO.deliveryOrders.length,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
