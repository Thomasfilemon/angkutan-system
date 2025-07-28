// src/controllers/web/purchaseOrderController.js
const {
  PurchaseOrder,
  DeliveryOrder,
  Vehicle,
  DriverProfile,
  User,
  BigDeliveryOrder,
  DepositGroup,
  DepositGroupMember,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");
const {
  calculateTotalAmount,
  calculateOngkosan,
} = require("./deliveryOrderController");

// Helper for percentage calculation
const calculateFulfillmentPercentage = (fulfilled, total) => {
  return fulfilled && total ? (fulfilled / parseFloat(total)) * 100 : 0;
};

// Enhanced calculation helper with unit awareness
const calculateTotalAmountPO = (quantity, unit, unitPrice) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
    case "ton":
    case "kubik":
      return qty * price;
    default:
      return qty * price;
  }
};

// Get all POs with enhanced web features and deposit group integration
exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (status) {
      whereClause.status = Array.isArray(status) ? { [Op.in]: status } : status;
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
          {
            model: DepositGroup,
            as: "depositGroup",
            attributes: ["id", "group_name", "status", "remaining_quantity", "target_quantity"],
            required: false,
          }
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      }
    );

    // Enhanced calculation with forecast integration and deposit group info
    const enhancedPOs = await Promise.all(
      purchaseOrders.map(async (po) => {
        let stats;
        try {
          // Try to use enhanced forecast method (from incoming)
          stats = await po.getRemainingAndForecast();
        } catch (err) {
          console.error(`Forecast failed for PO ${po.id}:`, err);
          console.warn(`Using manual fallback for PO ${po.id}`);
          
          // Enhanced manual fallback (from incoming)
          const dos = await po.getPoDeliveryOrders();
          let fulfilledActual = 0;
          let estimatedPending = 0;
          dos.forEach((d) => {
            if (d.status === "completed")
              fulfilledActual += parseFloat(d.actual_load_quantity) || 0;
            else estimatedPending += parseFloat(d.minimal_load_quantity) || 0;
          });
          const remaining =
            parseFloat(po.total_quantity) -
            (fulfilledActual + estimatedPending);
          stats = {
            fulfilled_actual: fulfilledActual,
            estimated_pending: estimatedPending,
            remaining_quantity: remaining > 0 ? remaining : 0,
            fulfillment_status:
              fulfilledActual + estimatedPending >=
              parseFloat(po.total_quantity)
                ? "complete"
                : "partial",
          };
        }

        // Extract deposit group info (from current)
        const depositGroup = po.depositGroup ? {
          id: po.depositGroup.id,
          name: po.depositGroup.group_name,
          status: po.depositGroup.status,
          remaining_quantity: parseFloat(po.depositGroup.remaining_quantity || 0),
          target_quantity: parseFloat(po.depositGroup.target_quantity || 0)
        } : null;

        return {
          ...po.toJSON(),
          ...stats,
          delivery_progress: {
            total_deliveries: po.poDeliveryOrders?.length || 0,
            completed_deliveries:
              po.poDeliveryOrders?.filter((d) => d.status === "completed")
                .length || 0,
            percentage:
              (stats.fulfilled_actual / parseFloat(po.total_quantity)) * 100 ||
              0,
            delivered_units: stats.fulfilled_actual,
            pending_units: stats.estimated_pending,
          },
          can_create_do:
            stats.remaining_quantity > 0 && po.status !== "cancelled",
          // Deposit group integration (from current)
          deposit_group: depositGroup,
          is_deposit_linked: !!depositGroup,
        };
      })
    );

    // Enhanced statistics with deposit group stats (from current)
    const depositStats = {
      linked_to_deposit: enhancedPOs.filter(po => po.is_deposit_linked).length,
      not_linked: enhancedPOs.filter(po => !po.is_deposit_linked).length,
    };

    // Enhanced summary stats calculation (from incoming)
    const [totalActive, totalCompleted, totalCancelled] = await Promise.all([
      PurchaseOrder.count({
        where: {
          ...whereClause,
          status: { [Op.in]: ["confirmed", "partial"] },
        },
      }),
      PurchaseOrder.count({ where: { ...whereClause, status: "completed" } }),
      PurchaseOrder.count({ where: { ...whereClause, status: "cancelled" } }),
    ]);

    const stats = {
      total: count,
      active: totalActive,
      completed: totalCompleted,
      cancelled: totalCancelled,
      deposit_group_stats: depositStats,
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
    console.error("Error getting all POs:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Get PO by ID with detailed info and enhanced forecast
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
        {
          model: DepositGroup,
          as: "depositGroup",
          attributes: ["id", "group_name", "status", "remaining_quantity", "target_quantity"],
          required: false,
        }
      ],
    });

    if (!po) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    // Enhanced forecast integration (from incoming)
    let stats;
    try {
      stats = await po.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for PO ${id}:`, err);
      // Enhanced manual fallback
      const dos = await po.getPoDeliveryOrders();
      let fulfilledActual = 0;
      let estimatedPending = 0;
      dos.forEach((d) => {
        if (d.status === "completed")
          fulfilledActual += parseFloat(d.actual_load_quantity) || 0;
        else estimatedPending += parseFloat(d.minimal_load_quantity) || 0;
      });
      const remaining =
        parseFloat(po.total_quantity) - (fulfilledActual + estimatedPending);
      stats = {
        fulfilled_actual: fulfilledActual,
        estimated_pending: estimatedPending,
        remaining_quantity: remaining > 0 ? remaining : 0,
        fulfillment_status:
          fulfilledActual + estimatedPending >= parseFloat(po.total_quantity)
            ? "complete"
            : "partial",
      };
    }

    // Extract deposit group info
    const depositGroup = po.depositGroup ? {
      id: po.depositGroup.id,
      name: po.depositGroup.group_name,
      status: po.depositGroup.status,
      remaining_quantity: parseFloat(po.depositGroup.remaining_quantity || 0),
      target_quantity: parseFloat(po.depositGroup.target_quantity || 0)
    } : null;

    res.json({
      success: true,
      data: {
        ...po.toJSON(),
        ...stats,
        delivery_progress: {
          percentage: calculateFulfillmentPercentage(
            stats.fulfilled_actual,
            po.total_quantity
          ),
          is_complete: stats.remaining_quantity <= 0,
        },
        deposit_group: depositGroup,
        is_deposit_linked: !!depositGroup,
      },
    });
  } catch (err) {
    console.error("Error getting PO by ID:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Create new PO with enhanced validation and deposit group support
exports.createPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
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
      deposit_group_id
    } = req.body;

    // Enhanced validation (from incoming)
    if (
      !customer_name ||
      !item_name ||
      !total_quantity ||
      isNaN(parseFloat(total_quantity)) ||
      parseFloat(total_quantity) < 0.01 ||
      !unit ||
      !["kilogram", "ton", "kubik"].includes(unit)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing required fields (customer_name, item_name, total_quantity (>=0.01), unit)",
      });
    }

    // Validate deposit group if provided (from current)
    if (deposit_group_id) {
      const groupExists = await DepositGroup.findByPk(deposit_group_id, { transaction });
      if (!groupExists) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Deposit group not found' 
        });
      }
    }

    // Enhanced PO number generation with collision handling (from incoming)
    const yearMonth = `${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}`;
    const poCount = await PurchaseOrder.count({
      where: { po_number: { [Op.like]: `PO-${yearMonth}-%` } },
      transaction,
    });

    let poNumber;
    let attempts = 0;
    do {
      poNumber = `PO-${yearMonth}-${String(poCount + 1 + attempts).padStart(
        4,
        "0"
      )}`;
      const existing = await PurchaseOrder.findOne({
        where: { po_number: poNumber },
        transaction,
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique PO number",
      });
    }

    const newPO = await PurchaseOrder.create(
      {
        po_number: poNumber,
        customer_name,
        item_name,
        total_quantity,
        unit,
        unit_price: unit_price || 0,
        total_amount: calculateTotalAmountPO(total_quantity, unit, unit_price),
        load_location,
        unload_location,
        load_latitude,
        load_longitude,
        unload_latitude,
        unload_longitude,
        notes,
        deposit_group_id,
        status: "confirmed",
      },
      { transaction }
    );

    // Enhanced initial stats calculation (from incoming)
    let initialStats;
    try {
      initialStats = await newPO.getRemainingAndForecast();
    } catch (err) {
      console.error(`Initial forecast failed for PO ${newPO.id}:`, err);
      initialStats = {
        remaining_quantity: parseFloat(total_quantity),
        fulfilled_actual: 0,
        estimated_pending: 0,
        fulfillment_status: "pending",
      };
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      data: {
        ...newPO.toJSON(),
        unit_display: newPO.getUnitDisplay() || unit,
        price_display: newPO.getPriceDisplay ? newPO.getPriceDisplay() : null,
        ...initialStats,
        deposit_group_linked: !!deposit_group_id,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error creating PO:", err);
    if (err.name === "SequelizeValidationError") {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Update PO with enhanced validation and deposit group management
exports.updatePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { recordAsAdjustment, deposit_group_id, ...updateData } = req.body;

    const po = await PurchaseOrder.findByPk(id, { transaction });

    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    // Enhanced validation (from incoming)
    if (
      updateData.unit &&
      !["kilogram", "ton", "kubik"].includes(updateData.unit)
    ) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid unit" });
    }

    if (updateData.total_quantity !== undefined) {
      const newTotal = parseFloat(updateData.total_quantity);
      if (isNaN(newTotal) || newTotal < 0.01) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Invalid total_quantity (>=0.01)" });
      }
      if (req.user?.role !== "admin") {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "Only admins can update total_quantity",
        });
      }
      
      // Enhanced validation against fulfilled amount (from incoming)
      let stats;
      try {
        stats = await po.getRemainingAndForecast();
      } catch (err) {
        stats = { fulfilled_actual: 0 };
      }
      if (newTotal < stats.fulfilled_actual) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "New total_quantity cannot be less than fulfilled amount",
        });
      }
    }

    // Handle deposit group changes (from current)
    if (deposit_group_id !== undefined && deposit_group_id !== po.deposit_group_id) {
      if (deposit_group_id) {
        const group = await DepositGroup.findByPk(deposit_group_id, { transaction });
        if (!group) {
          await transaction.rollback();
          return res.status(400).json({ 
            success: false, 
            message: 'Deposit group not found' 
          });
        }
      }
      updateData.deposit_group_id = deposit_group_id;
    }

    // Handle quantity mutation (from current)
    if (updateData.total_quantity) {
      const newQuantity = parseFloat(updateData.total_quantity);
      const oldQuantity = parseFloat(po.total_quantity);

      if (!recordAsAdjustment) {
        po.quantity_mutasi = [...(po.quantity_mutasi || []), oldQuantity];
      }

      updateData.total_quantity = newQuantity;
    }

    const updatedPO = await po.update(updateData, { transaction });

    // Retroactively link existing DOs to new deposit group (from current)
    if (updateData.deposit_group_id) {
      const existingDOs = await DeliveryOrder.findAll({
        where: { purchase_order_id: id },
        include: [{
          model: DepositGroupMember,
          as: 'groupMemberships',
          required: false
        }],
        transaction
      });

      for (const doItem of existingDOs) {
        const isAlreadyInGroup = doItem.groupMemberships && doItem.groupMemberships.length > 0;
        
        if (!isAlreadyInGroup) {
          await DepositGroupMember.create({
            group_id: updateData.deposit_group_id,
            delivery_order_id: doItem.id,
            quantity: doItem.minimal_load_quantity
          }, { transaction });
          
          console.log(`✅ Retroactively added DO ${doItem.do_number} to deposit group ${updateData.deposit_group_id}`);
        }
      }
    } else if (deposit_group_id === null) {
      // Handle unlinking from deposit group (from current)
      const existingDOs = await DeliveryOrder.findAll({
        where: { purchase_order_id: id },
        transaction
      });

      for (const doItem of existingDOs) {
        await DepositGroupMember.destroy({
          where: { delivery_order_id: doItem.id },
          transaction
        });
        
        console.log(`✅ Removed DO ${doItem.do_number} from deposit group`);
      }
    }

    // Enhanced stats calculation (from incoming)
    let stats;
    try {
      stats = await updatedPO.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for updated PO ${id}:`, err);
      stats = {
        remaining_quantity: parseFloat(updatedPO.total_quantity),
        fulfilled_actual: 0,
        estimated_pending: 0,
        fulfillment_status: "pending",
      };
    }

    await transaction.commit();

    // Return updated PO with deposit group info (from current)
    const finalPO = await PurchaseOrder.findByPk(id, {
      include: [{
        model: DepositGroup,
        as: 'depositGroup',
        attributes: ['id', 'group_name', 'status', 'remaining_quantity'],
        required: false
      }]
    });

    res.json({
      success: true,
      message: "Purchase Order updated successfully",
      data: {
        ...finalPO.toJSON(),
        ...stats,
        deposit_group_linked: !!finalPO.deposit_group_id,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating PO:", err);
    if (err.name === "SequelizeValidationError") {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Delete PO with enhanced validation (from incoming)
exports.deletePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findByPk(id, { transaction });

    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    // Enhanced validation with forecast (from incoming)
    let stats;
    try {
      stats = await po.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for delete PO ${id}:`, err);
      stats = { fulfillment_status: po.status };
    }
    if (stats.fulfillment_status !== "complete") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot delete PO that is not fully completed",
      });
    }

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
      transaction,
    });

    if (activeDeliveries > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot delete PO with active delivery orders",
      });
    }

    await po.destroy({ transaction });
    await transaction.commit();

    res.json({ success: true, message: "Purchase Order deleted successfully" });
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting PO:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Get PO details for creating DO with enhanced forecast
exports.getPoDetailsForNewDo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findByPk(id);
    if (!po) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    // Enhanced forecast integration (from incoming)
    let stats;
    try {
      stats = await po.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for PO ${id}:`, err);
      stats = {
        remaining_quantity: parseFloat(po.total_quantity),
        fulfilled_actual: 0,
        estimated_pending: 0,
        fulfillment_status: "pending",
      };
    }

    if (stats.remaining_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "No remaining quantity available for delivery",
      });
    }

    // Enhanced DO number generation (from incoming)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const generatedDoNumber = `DO-${timestamp}-${randomSuffix}`;

    res.json({
      success: true,
      data: {
        po_number: po.po_number,
        customer_name: po.customer_name,
        item_name: po.item_name,
        unit_price: parseFloat(po.unit_price) || 0,
        total_quantity: parseFloat(po.total_quantity),
        quantity_mutasi: po.quantity_mutasi || [],
        ...stats,
        generated_do_number: generatedDoNumber,
        load_location: po.load_location || "",
        unload_location: po.unload_location || "",
        load_latitude: po.load_latitude,
        load_longitude: po.load_longitude,
        unload_latitude: po.unload_latitude,
        unload_longitude: po.unload_longitude,
        has_location_data: po.hasLocationData ? po.hasLocationData() : !!(po.load_location && po.unload_location),
      },
    });
  } catch (err) {
    console.error("Error getting PO details for new DO:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Create DO from PO with enhanced validation and notifications
exports.createDeliveryOrderFromPO = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      driver_id,
      vehicle_id,
      item_name,
      minimal_load_quantity,
      unit_price,
      trip_allowance = 0,
      gaji = 0,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      do_name, // Added do_name
    } = req.body;

    const po = await PurchaseOrder.findByPk(id, { transaction });
    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    // ... (All validation logic for PO status, items, quantity, driver/vehicle availability remains the same)
    if (po.status === "completed" || po.status === "cancelled") {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Cannot create DO from completed or cancelled Purchase Order",
        });
      }
  
      // Enhanced validation (from incoming)
      if (!item_name) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "item_name is required" });
      }
      const poItems = po.item_name
        ? po.item_name.split(",").map((i) => i.trim().toLowerCase())
        : [];
      if (
        poItems.length === 0 ||
        !poItems.includes(item_name.trim().toLowerCase())
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid item_name: "${item_name}" not found in PO items: "${po.item_name}"`,
        });
      }
  
      // Enhanced numeric validation (from incoming)
      const finalUnitPrice = unit_price || po.unit_price;
      if (
        !finalUnitPrice ||
        isNaN(parseFloat(finalUnitPrice)) ||
        !minimal_load_quantity ||
        isNaN(parseFloat(minimal_load_quantity))
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "unit_price and minimal_load_quantity are required and must be numbers",
        });
      }
  
      // Enhanced forecast validation (from incoming)
      let stats;
      try {
        stats = await po.getRemainingAndForecast();
      } catch (err) {
        console.error(`Forecast failed for PO ${id}:`, err);
        const dos = await po.getPoDeliveryOrders({ transaction });
        let fulfilledActual = 0;
        let estimatedPending = 0;
        dos.forEach((d) => {
          if (d.status === "completed")
            fulfilledActual += parseFloat(d.actual_load_quantity) || 0;
          else estimatedPending += parseFloat(d.minimal_load_quantity) || 0;
        });
        const remaining =
          parseFloat(po.total_quantity) - (fulfilledActual + estimatedPending);
        stats = { remaining_quantity: remaining > 0 ? remaining : 0 };
      }
  
      if (stats.remaining_quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "No remaining quantity in this Purchase Order",
        });
      }
  
      if (parseFloat(minimal_load_quantity) > stats.remaining_quantity) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Minimal load quantity (${minimal_load_quantity}) exceeds remaining PO quantity (${stats.remaining_quantity})`,
        });
      }
  
      // Enhanced availability validation (from incoming)
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
        transaction,
      });
      if (activeDriverTrip) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Driver is currently assigned to another active trip",
        });
      }
  
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
        transaction,
      });
      if (activeVehicleTrip) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Vehicle is currently assigned to another active trip",
        });
      }
  
      const existingBigDO = await BigDeliveryOrder.findOne({
        where: { driver_id, status: { [Op.in]: ["assigned", "in_progress"] } },
        transaction,
      });
      if (existingBigDO) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Driver is already assigned to Big DO: ${existingBigDO.big_do_number}`,
        });
      }
  
      // Enhanced DO number generation (from incoming)
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      let attempts = 0;
      let doNumber;
      do {
        const randomSuffix = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        doNumber = `DO-${timestamp}-${randomSuffix}`;
        const existing = await DeliveryOrder.findOne({
          where: { do_number: doNumber },
          transaction,
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 100);
  
      if (attempts >= 100) {
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: "Failed to generate unique DO number",
        });
      }
  
      // Enhanced calculations (from incoming)
      const calculatedTotalAmount = calculateTotalAmount(
        minimal_load_quantity,
        finalUnitPrice,
        po.unit
      );
      const calculatedOngkosan = calculateOngkosan(
        calculatedTotalAmount,
        trip_allowance,
        gaji
      );
  
      // Build temp DO for validation (from incoming)
      const tempDO = DeliveryOrder.build({
        purchase_order_id: id,
        driver_id,
        vehicle_id,
        do_number: doNumber,
        customer_name: po.customer_name,
        item_name,
        minimal_load_quantity,
        unit: po.unit,
        unit_price: finalUnitPrice,
        total_amount: calculatedTotalAmount,
        trip_allowance,
        gaji,
        ongkosan: calculatedOngkosan,
        load_location: load_location || po.load_location,
        unload_location: unload_location || po.unload_location,
        load_latitude: load_latitude || po.load_latitude,
        load_longitude: load_longitude || po.load_longitude,
        unload_latitude: unload_latitude || po.unload_latitude,
        unload_longitude: unload_longitude || po.unload_longitude,
        payment_status: "proses_tagihan",
        status: "assigned",
        do_name: do_name,
      });
  
      if (tempDO.validateQuantityAgainstPO) {
        await tempDO.validateQuantityAgainstPO(false);
      }
  
      const newDO = await DeliveryOrder.create(tempDO.dataValues, {
        transaction,
      });
    
    // *** FIX STARTS HERE ***
    // Automatically add the new DO to the deposit group if the parent PO is linked.
    if (po.deposit_group_id) {
        await DepositGroupMember.create({
            group_id: po.deposit_group_id,
            delivery_order_id: newDO.id,
            quantity: newDO.minimal_load_quantity // Use the planned quantity initially
        }, { transaction });
        console.log(`✅ Auto-added new DO ${newDO.do_number} to deposit group ${po.deposit_group_id}`);
    }
    // *** FIX ENDS HERE ***

    // Update driver and vehicle status
    await DriverProfile.update(
      { status: "busy" },
      { where: { user_id: driver_id }, transaction }
    );

    await Vehicle.update(
      { status: "in_use" },
      { where: { id: vehicle_id }, transaction }
    );

    // ... (rest of the function for push notifications and response)
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
            body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${newDO.do_number}. Silakan cek detail pengantaran di aplikasi.`,
            data: { do_number: newDO.do_number },
          },
        ];
        try {
          await expo.sendPushNotificationsAsync(messages);
        } catch (pushError) {
          console.error("Push notification error in createDOFromPO:", pushError);
        }
      }
  
      // Update PO status
      if (po.status === "confirmed") {
        await po.update({ status: "partial" }, { transaction });
      }
  
      // Enhanced stats calculation (from incoming)
      let updatedStats;
      try {
        updatedStats = await po.getRemainingAndForecast();
      } catch (err) {
        updatedStats = {};
      }
  
      await transaction.commit();
  
      res.status(201).json({
        success: true,
        message: "Delivery Order created successfully from Purchase Order",
        data: {
          ...newDO.toJSON(),
          financial_summary: newDO.getFinancialSummary ? newDO.getFinancialSummary() : null,
          remaining_po_quantity: updatedStats.remaining_quantity || 0,
          po_stats: updatedStats,
        },
      });

  } catch (err) {
    await transaction.rollback();
    console.error("Error creating DO from PO:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Get available POs for delivery with enhanced forecast
exports.getAvailablePOsForDelivery = async (req, res, next) => {
  try {
    const availablePOs = await PurchaseOrder.findAll({
      where: { status: { [Op.in]: ["confirmed", "partial"] } },
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

    // Enhanced forecast integration (from incoming)
    const posWithRemaining = await Promise.all(
      availablePOs.map(async (po) => {
        let stats;
        try {
          stats = await po.getRemainingAndForecast();
        } catch (err) {
          console.error(`Forecast failed for available PO ${po.id}:`, err);
          stats = {
            remaining_quantity: parseFloat(po.total_quantity),
            fulfilled_actual: 0,
            estimated_pending: 0,
            fulfillment_status: "pending",
          };
        }
        return {
          ...po.toJSON(),
          ...stats,
          can_create_do: stats.remaining_quantity > 0,
        };
      })
    );

    const filteredPOs = posWithRemaining.filter((po) => po.can_create_do);

    res.json({
      success: true,
      data: filteredPOs,
      total: filteredPOs.length,
    });
  } catch (err) {
    console.error("Error getting available POs for delivery:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};
