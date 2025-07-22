// src/controllers/web/purchaseOrderController.js
const {
  PurchaseOrder,
  DeliveryOrder,
  Vehicle,
  DriverProfile,
  User,
} = require("../../models");
const { Op } = require("sequelize");

// Get all POs with enhanced web features
exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    // ✅ FIXED: Remove TypeScript type annotation
    let whereClause = {};

    if (status) {
      if (Array.isArray(status)) {
        whereClause.status = { [Op.in]: status };
      } else {
        whereClause.status = status;
      }
    }

    if (search) {
      whereClause[Op.or] = [
        { po_number: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: purchaseOrders } = await PurchaseOrder.findAndCountAll(
      {
        where: whereClause,
        include: [
          {
            model: DeliveryOrder,
            as: "poDeliveryOrders",
            attributes: ["id", "do_number", "status", "actual_load_quantity"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: offset,
      }
    );

    // Calculate remaining quantities and delivery stats
    const enhancedPOs = await Promise.all(
      purchaseOrders.map(async (po) => {
        const totalDelivered =
          (await DeliveryOrder.sum("actual_load_quantity", {
            where: {
              purchase_order_id: po.id,
              status: "completed",
              actual_load_quantity: { [Op.ne]: null },
            },
          })) || 0;

        const remainingQuantity =
          parseFloat(po.total_quantity) - totalDelivered;
        const deliveryCount = po.poDeliveryOrders?.length || 0;
        const completedDeliveries =
          po.poDeliveryOrders?.filter((d) => d.status === "completed").length ||
          0;

        return {
          ...po.toJSON(),
          delivered_quantity: totalDelivered,
          remaining_quantity: remainingQuantity,
          delivery_progress: {
            total_deliveries: deliveryCount,
            completed_deliveries: completedDeliveries,
            percentage:
              po.total_quantity > 0
                ? (totalDelivered / parseFloat(po.total_quantity)) * 100
                : 0,
          },
          can_create_do: remainingQuantity > 0 && po.status !== "cancelled",
        };
      })
    );

    // Calculate summary stats
    const stats = {
      total: enhancedPOs.length, // ✅ FIX: Use actual results, not DB count
      active: enhancedPOs.filter((po) =>
        ["confirmed", "partial"].includes(po.status)
      ).length,
      completed: enhancedPOs.filter((po) => po.status === "completed").length,
      cancelled: enhancedPOs.filter((po) => po.status === "cancelled").length,
    };

    res.json({
      success: true,
      data: enhancedPOs,
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

// Get PO by ID with detailed info
exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: DeliveryOrder,
          as: "poDeliveryOrders",
          include: [
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
          ],
        },
      ],
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Calculate delivery statistics
    const totalDelivered =
      (await DeliveryOrder.sum("actual_load_quantity", {
        where: {
          purchase_order_id: id,
          status: "completed",
          actual_load_quantity: { [Op.ne]: null },
        },
      })) || 0;

    const remainingQuantity = parseFloat(po.total_quantity) - totalDelivered;

    res.json({
      success: true,
      data: {
        ...po.toJSON(),
        delivered_quantity: totalDelivered,
        remaining_quantity: remainingQuantity,
        delivery_progress: {
          percentage:
            po.total_quantity > 0
              ? (totalDelivered / parseFloat(po.total_quantity)) * 100
              : 0,
          is_complete: remainingQuantity <= 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Create new PO (enhanced for web)
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      customer_name,
      item_name,
      total_quantity,
      unit,
      unit_price,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      notes,
    } = req.body;

    const calculateTotalAmount = (quantity, unit, unitPrice) => {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(unitPrice) || 0;

      switch (unit) {
        case "kilogram":
          return qty * price;
        case "ton":
          return qty * price;
        case "kubik":
          return qty * price; // Direct kubik pricing
        default:
          return qty * price;
      }
    };

    // Generate PO number
    const poCount = await PurchaseOrder.count({
      where: {
        created_at: {
          [Op.gte]: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ),
        },
      },
    });

    const poNumber = `PO-${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-${String(poCount + 1).padStart(4, "0")}`;

    const newPO = await PurchaseOrder.create({
      po_number: poNumber,
      customer_name,
      item_name,
      total_quantity,
      unit,
      unit_price: unit_price || 0,
      total_amount: calculateTotalAmount(total_quantity, unit, unit_price),
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      notes,
      status: "confirmed",
    });

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      data: {
        ...newPO.toJSON(),
        unit_display: newPO.getUnitDisplay(),
        price_display: newPO.getPriceDisplay(),
      },
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
    next(err);
  }
};

// Update PO
// Update PO
exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recordAsAdjustment, ...updateData } = req.body;
    const po = await PurchaseOrder.findByPk(id);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Handle quantity mutation only when recordAsAdjustment is true
    if (updateData.total_quantity) {
      const newQuantity = parseFloat(updateData.total_quantity);
      const oldQuantity = parseFloat(po.total_quantity);

      if (!recordAsAdjustment) {
        po.quantity_mutasi = [...(po.quantity_mutasi || []), oldQuantity];
      }

      po.total_quantity = newQuantity;
    }

    // Apply other fields from updateData
    po.set(updateData);

    // Save all changes
    await po.save();

    res.json({
      success: true,
      message: "Purchase Order updated successfully",
      data: po.toJSON(),
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
    next(err);
  }
};

// Delete PO
exports.deletePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findByPk(id);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Check if PO has active delivery orders
    const activeDeliveries = await DeliveryOrder.count({
      where: {
        purchase_order_id: id,
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
    });

    if (activeDeliveries > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete PO with active delivery orders",
      });
    }

    await po.destroy();

    res.json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get PO details for creating DO
exports.getPoDetailsForNewDo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findByPk(id);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Calculate delivered quantity
    const totalDelivered =
      (await DeliveryOrder.sum("actual_load_quantity", {
        where: {
          purchase_order_id: id,
          status: "completed",
          actual_load_quantity: { [Op.ne]: null },
        },
      })) || 0;

    const remainingQuantity = parseFloat(po.total_quantity) - totalDelivered;

    if (remainingQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "No remaining quantity available for delivery",
      });
    }

    // Generate DO number
    const doCount = await DeliveryOrder.count({
      where: {
        created_at: {
          [Op.gte]: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ),
        },
      },
    });

    const generatedDoNumber = `DO-${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-${String(doCount + 1).padStart(4, "0")}`;

    res.json({
      success: true,
      data: {
        po_number: po.po_number,
        customer_name: po.customer_name,
        item_name: po.item_name,
        unit_price: parseFloat(po.unit_price) || 0,
        total_quantity: parseFloat(po.total_quantity),
        quantity_mutasi: po.quantity_mutasi || [],
        delivered_quantity: totalDelivered,
        remaining_quantity: remainingQuantity,
        generated_do_number: generatedDoNumber,
        load_location: po.load_location || "",
        unload_location: po.unload_location || "",
        load_latitude: po.load_latitude,
        load_longitude: po.load_longitude,
        unload_latitude: po.unload_latitude,
        unload_longitude: po.unload_longitude,
        has_location_data: !!(po.load_location && po.unload_location),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Create DO from PO
exports.createDeliveryOrderFromPO = async (req, res, next) => {
  try {
    const { id } = req.params; // PO ID
    const {
      driver_id,
      vehicle_id,
      minimal_load_quantity,
      trip_allowance,
      gaji,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
    } = req.body;

    // Validate PO exists
    const po = await PurchaseOrder.findByPk(id);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    if (po.status === "completed" || po.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot create DO from completed or cancelled Purchase Order",
      });
    }

    // Check remaining quantity
    const totalDelivered =
      (await DeliveryOrder.sum("actual_load_quantity", {
        where: {
          purchase_order_id: id,
          status: "completed",
          actual_load_quantity: { [Op.ne]: null },
        },
      })) || 0;

    const remainingQuantity = parseFloat(po.total_quantity) - totalDelivered;

    if (remainingQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "No remaining quantity in this Purchase Order",
      });
    }

    if (parseFloat(minimal_load_quantity) > remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: `Minimal load quantity (${minimal_load_quantity}) exceeds remaining PO quantity (${remainingQuantity})`,
      });
    }

    // Validate driver availability
    const activeDriverTrip = await DeliveryOrder.findOne({
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
    });

    if (activeDriverTrip) {
      return res.status(400).json({
        success: false,
        message: "Driver is currently assigned to another active trip",
      });
    }

    // Validate vehicle availability
    const activeVehicleTrip = await DeliveryOrder.findOne({
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
    });

    if (activeVehicleTrip) {
      return res.status(400).json({
        success: false,
        message: "Vehicle is currently assigned to another active trip",
      });
    }

    // Generate DO number
    const doCount = await DeliveryOrder.count({
      where: {
        created_at: {
          [Op.gte]: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ),
        },
      },
    });

    const doNumber = `DO-${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-${String(doCount + 1).padStart(4, "0")}`;

    // Create Delivery Order
    const newDO = await DeliveryOrder.create({
      purchase_order_id: id,
      driver_id,
      vehicle_id,
      do_number: doNumber,
      customer_name: po.customer_name,
      item_name: po.item_name,
      minimal_load_quantity,
      unit_price: po.unit_price || 0,
      total_amount:
        parseFloat(minimal_load_quantity) * (parseFloat(po.unit_price) || 0),
      trip_allowance,
      gaji,
      load_location: load_location || po.load_location,
      unload_location: unload_location || po.unload_location,
      load_latitude: load_latitude || po.load_latitude,
      load_longitude: load_longitude || po.load_longitude,
      unload_latitude: unload_latitude || po.unload_latitude,
      unload_longitude: unload_longitude || po.unload_longitude,
      payment_status: "proses_tagihan",
      status: "assigned",
    });

    // Update driver and vehicle status
    await DriverProfile.update(
      { status: "busy" },
      { where: { user_id: driver_id } }
    );

    await Vehicle.update({ status: "in_use" }, { where: { id: vehicle_id } });

    // Update PO status to partial if not already
    if (po.status === "confirmed") {
      await po.update({ status: "partial" });
    }

    res.status(201).json({
      success: true,
      message: "Delivery Order created successfully from Purchase Order",
      data: {
        ...newDO.toJSON(),
        financial_summary: newDO.getFinancialSummary(),
        remaining_po_quantity:
          remainingQuantity - parseFloat(minimal_load_quantity),
      },
    });
  } catch (err) {
    console.error("Error creating DO from PO:", err);
    next(err);
  }
};

// Get available POs for delivery
exports.getAvailablePOsForDelivery = async (req, res, next) => {
  try {
    const availablePOs = await PurchaseOrder.findAll({
      where: {
        status: {
          [Op.in]: ["confirmed", "partial"],
        },
      },
      attributes: [
        "id",
        "po_number",
        "customer_name",
        "item_name",
        "total_quantity",
        "quantity_mutasi",
        "load_location",
        "unload_location",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
    });

    // Calculate remaining quantity for each PO
    const posWithRemaining = await Promise.all(
      availablePOs.map(async (po) => {
        const totalDelivered =
          (await DeliveryOrder.sum("actual_load_quantity", {
            where: {
              purchase_order_id: po.id,
              status: "completed",
              actual_load_quantity: { [Op.ne]: null },
            },
          })) || 0;

        const remainingQuantity =
          parseFloat(po.total_quantity) - totalDelivered;

        return {
          ...po.toJSON(),
          delivered_quantity: totalDelivered,
          remaining_quantity: remainingQuantity,
          can_create_do: remainingQuantity > 0,
        };
      })
    );

    // Filter only POs that can create DO
    const filteredPOs = posWithRemaining.filter((po) => po.can_create_do);

    res.json({
      success: true,
      data: filteredPOs,
      total: filteredPOs.length,
    });
  } catch (err) {
    next(err);
  }
};
