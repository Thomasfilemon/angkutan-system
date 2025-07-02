// src/controllers/mobile/bigDeliveryOrderController.js
const {
  BigDeliveryOrder,
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverProfile,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

/**
 * 🎯 GET DRIVER'S ACTIVE BIG DO
 * GET /api/big-delivery-orders/driver/:driver_id/active
 */
exports.getDriverActiveBigDO = async (req, res, next) => {
  try {
    const { driver_id } = req.params;

    const bigDO = await BigDeliveryOrder.findOne({
      where: {
        driver_id,
        status: { [Op.in]: ["assigned", "in_progress"] },
      },
      include: [
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
          order: [["display_order", "ASC"]],
        },
      ],
    });

    if (!bigDO) {
      return res.json({
        success: true,
        data: null,
        message: "No active Big DO assignment",
      });
    }

    // Mobile-friendly response
    const response = {
      big_do_info: {
        id: bigDO.id,
        big_do_number: bigDO.big_do_number,
        status: bigDO.status,
        status_text: bigDO.getStatusText(),
        total_dos: bigDO.deliveryOrders.length,
        completed_dos: bigDO.deliveryOrders.filter(
          (dOrder) => dOrder.status === "completed"
        ).length,
        financial_summary: bigDO.getFinancialSummary(),
      },
      vehicle_info: {
        license_plate: bigDO.vehicle.license_plate,
        type: bigDO.vehicle.type,
      },
      delivery_orders: bigDO.deliveryOrders.map((dOrder) => ({
        id: dOrder.id,
        do_number: dOrder.do_number,
        po_number: dOrder.purchaseOrder?.po_number,
        customer_name: dOrder.customer_name,
        item_name: dOrder.item_name,
        minimal_load_quantity: dOrder.minimal_load_quantity,
        unit: dOrder.unit,
        unit_display: dOrder.getUnitDisplay(),
        load_location: dOrder.load_location,
        unload_location: dOrder.unload_location,
        status: dOrder.status,
        status_text: dOrder.getStatusText(),
        can_start:
          bigDO.status === "in_progress" && dOrder.status === "assigned",
      })),
      workflow_info: {
        instruction:
          "Complete all deliveries in any order you prefer, then mark Big DO as completed",
        completion_rule:
          "Individual DOs will be marked complete when you complete the Big DO",
        driver_freedom:
          "You can choose the delivery sequence based on route efficiency",
      },
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🎯 START BIG DO (Driver accepts assignment)
 * PATCH /api/big-delivery-orders/:id/start
 */
exports.startBigDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { driver_id } = req.body; // From token validation

    const bigDO = await BigDeliveryOrder.findOne({
      where: {
        id,
        driver_id,
        status: "assigned",
      },
      transaction,
    });

    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big DO not found or not available to start",
      });
    }

    await bigDO.update(
      {
        status: "in_progress",
        started_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Big DO started successfully",
      data: {
        big_do_number: bigDO.big_do_number,
        status: "in_progress",
        started_at: bigDO.started_at,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 COMPLETE BIG DO (All deliveries done)
 * PATCH /api/big-delivery-orders/:id/complete
 */
exports.completeBigDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { actual_quantities, completion_notes } = req.body;
    // actual_quantities: [{ do_id: 1, actual_quantity: 34.5 }, ...]

    const bigDO = await BigDeliveryOrder.findByPk(id, {
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          where: { status: { [Op.not]: "completed" } },
          required: false,
        },
      ],
      transaction,
    });

    if (!bigDO) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Big DO not found",
      });
    }

    if (bigDO.status !== "in_progress") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Big DO must be in progress to complete",
      });
    }

    const completedAt = new Date();

    // Complete all individual DOs
    for (const individualDO of bigDO.deliveryOrders) {
      const actualQty = actual_quantities?.find(
        (aq) => aq.do_id === individualDO.id
      );

      await individualDO.update(
        {
          actual_load_quantity:
            actualQty?.actual_quantity || individualDO.minimal_load_quantity,
          status: "completed",
          completed_at: completedAt,
          notes: completion_notes || "Completed via Big DO bulk completion",
        },
        { transaction }
      );
    }

    // Complete Big DO
    await bigDO.update(
      {
        status: "completed",
        completed_at: completedAt,
      },
      { transaction }
    );

    // Free up vehicle
    await Vehicle.update(
      { status: "available" },
      { where: { id: bigDO.vehicle_id }, transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Big Delivery Order completed successfully",
      data: {
        big_do_number: bigDO.big_do_number,
        completed_dos: bigDO.deliveryOrders.length,
        completed_at: completedAt,
        financial_summary: bigDO.getFinancialSummary(),
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * 🎯 GET BIG DO DETAILS (Driver view)
 * GET /api/big-delivery-orders/:id
 */
exports.getBigDeliveryOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bigDO = await BigDeliveryOrder.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
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

    res.json({
      success: true,
      data: {
        ...bigDO.toJSON(),
        status_text: bigDO.getStatusText(),
        financial_summary: bigDO.getFinancialSummary(),
        deliveryOrders: bigDO.deliveryOrders.map((dOrder) => ({
          ...dOrder.toJSON(),
          unit_display: dOrder.getUnitDisplay(),
          status_text: dOrder.getStatusText(),
          financial_summary: dOrder.getFinancialSummary(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
