// src/controllers/web/purchaseOrderController.js
const {
  PurchaseOrder,
  DeliveryOrder,
  Vehicle,
  DriverProfile,
  User,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");
const {
  calculateTotalAmount,
  calculateOngkosan,
} = require("./deliveryOrderController"); // Import for calcs

// Helper for percentage (DRY)
const calculateFulfillmentPercentage = (fulfilled, total) => {
  return fulfilled && total ? (fulfilled / parseFloat(total)) * 100 : 0;
};

// Get all POs with enhanced web features
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
            as: "poDeliveryOrders", // Matches association alias
            attributes: ["id", "do_number", "status", "actual_load_quantity"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: offset,
      }
    );

    // Calculate remaining quantities and delivery stats with model method (FIXED: Fallback manual if method fails)
    const enhancedPOs = await Promise.all(
      purchaseOrders.map(async (po) => {
        let stats;
        try {
          stats = await po.getRemainingAndForecast();
        } catch (err) {
          console.error(`Forecast failed for PO ${po.id}:`, err);
          console.warn(`Using manual fallback for PO ${po.id}`); // FIXED: Warn for visibility
          // Manual fallback using associations
          const dos = await po.getPoDeliveryOrders(); // Use alias method
          let fulfilledActual = 0;
          let estimatedPending = 0;
          dos.forEach((d) => {
            if (d.status === "completed")
              fulfilledActual += parseFloat(d.actual_load_quantity) || 0;
            else estimatedPending += parseFloat(d.minimal_load_quantity) || 0;
          });
          const remaining =
            parseFloat(po.total_quantity) -
            (fulfilledActual + estimatedPending); // FIXED: parseFloat for safety
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
              0, // FIXED: Unit-based % (fulfilled_actual / total_quantity)
            delivered_units: stats.fulfilled_actual, // FIXED: New field for UI (sum of actual_load_quantity for completed)
            pending_units: stats.estimated_pending, // FIXED: New field for UI (sum of minimal for non-completed)
          },
          can_create_do:
            stats.remaining_quantity > 0 && po.status !== "cancelled",
        };
      })
    );

    // Calculate summary stats
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
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    let stats;
    try {
      stats = await po.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for PO ${id}:`, err);
      // Manual fallback
      const dos = await po.getPoDeliveryOrders();
      let fulfilledActual = 0;
      let estimatedPending = 0;
      dos.forEach((d) => {
        if (d.status === "completed")
          fulfilledActual += parseFloat(d.actual_load_quantity) || 0;
        else estimatedPending += parseFloat(d.minimal_load_quantity) || 0;
      });
      const remaining =
        po.total_quantity - (fulfilledActual + estimatedPending);
      stats = {
        fulfilled_actual: fulfilledActual,
        estimated_pending: estimatedPending,
        remaining_quantity: remaining > 0 ? remaining : 0,
        fulfillment_status:
          fulfilledActual + estimatedPending >= po.total_quantity
            ? "complete"
            : "partial",
      };
    }

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
      },
    });
  } catch (err) {
    console.error("Error getting PO by ID:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Create new PO (enhanced for web)
exports.createPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customer_name,
      item_name,
      total_quantity,
      unit,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      notes,
    } = req.body;

    // FIXED: Validate required + numeric + unit (per model)
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

    // Generate PO number (FIXED: Use yearMonth from model style, uniqueness in transaction)
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
        total_amount: 0,
        load_location,
        unload_location,
        load_latitude,
        load_longitude,
        unload_latitude,
        unload_longitude,
        notes,
        status: "confirmed",
      },
      { transaction }
    );

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
      }; // Manual fallback (no DOs yet)
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      data: {
        ...newPO.toJSON(),
        unit_display: newPO.getUnitDisplay() || unit,
        ...initialStats,
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

// Update PO (added check for total_quantity edits)
exports.updatePurchaseOrder = async (req, res, next) => {
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

    // FIXED: Validate updates (e.g., unit, total_quantity numeric/min)
    if (
      req.body.unit &&
      !["kilogram", "ton", "kubik"].includes(req.body.unit)
    ) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid unit" });
    }
    if (req.body.total_quantity !== undefined) {
      const newTotal = parseFloat(req.body.total_quantity);
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
      let stats;
      try {
        stats = await po.getRemainingAndForecast();
      } catch (err) {
        stats = { fulfilled_actual: 0 }; // Fallback
      }
      if (newTotal < stats.fulfilled_actual) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "New total_quantity cannot be less than fulfilled amount",
        });
      }
    }

    const updatedPO = await po.update(req.body, { transaction });

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
      }; // Fallback
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Purchase Order updated successfully",
      data: { ...updatedPO.toJSON(), ...stats },
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

// Delete PO (unchanged, but added check for remaining)
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

    let stats;
    try {
      stats = await po.getRemainingAndForecast();
    } catch (err) {
      console.error(`Forecast failed for delete PO ${id}:`, err);
      stats = { fulfillment_status: po.status }; // Fallback
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

// Get PO details for creating DO (enhanced with forecast)
exports.getPoDetailsForNewDo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findByPk(id);
    if (!po) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

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
      }; // Fallback
    }

    if (stats.remaining_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "No remaining quantity available for delivery",
      });
    }

    // Generate DO number suggestion (FIXED: Match create)
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
        total_quantity: parseFloat(po.total_quantity),
        ...stats,
        generated_do_number: generatedDoNumber,
        load_location: po.load_location || "",
        unload_location: po.unload_location || "",
        load_latitude: po.load_latitude,
        load_longitude: po.load_longitude,
        unload_latitude: po.unload_latitude,
        unload_longitude: po.unload_longitude,
        has_location_data: po.hasLocationData(), // FIXED: Use model method
      },
    });
  } catch (err) {
    console.error("Error getting PO details for new DO:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

// Create DO from PO (added validation)
exports.createDeliveryOrderFromPO = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params; // PO ID
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
    } = req.body;

    const po = await PurchaseOrder.findByPk(id, { transaction });
    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }

    if (po.status === "completed" || po.status === "cancelled") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot create DO from completed or cancelled Purchase Order",
      });
    }

    // FIXED: Validate item_name
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

    // FIXED: Validate unit_price and quantities
    if (
      !unit_price ||
      isNaN(parseFloat(unit_price)) ||
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

    // Use PO's getRemainingAndForecast for initial check
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
        po.total_quantity - (fulfilledActual + estimatedPending);
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

    // Validate driver/vehicle (add bigDO check like DO create)
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

    const existingBigDO = await db.BigDeliveryOrder.findOne({
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

    // Generate DO number
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

    // Calcs
    const calculatedTotalAmount = calculateTotalAmount(
      minimal_load_quantity,
      unit_price,
      po.unit
    );
    const calculatedOngkosan = calculateOngkosan(
      calculatedTotalAmount,
      trip_allowance,
      gaji
    );

    // Build temp DO for validation (per DO model)
    const tempDO = db.DeliveryOrder.build({
      purchase_order_id: id,
      driver_id,
      vehicle_id,
      do_number: doNumber,
      customer_name: po.customer_name,
      item_name,
      minimal_load_quantity,
      unit: po.unit,
      unit_price,
      total_amount: calculatedTotalAmount,
      trip_allowance,
      gaji,
      ongkosan: calculatedOngkosan,
      final_amount: calculatedTotalAmount,
      load_location: load_location || po.load_location,
      unload_location: unload_location || po.unload_location,
      load_latitude: load_latitude || po.load_latitude,
      load_longitude: load_longitude || po.load_longitude,
      unload_latitude: unload_latitude || po.unload_latitude,
      unload_longitude: unload_longitude || po.unload_longitude,
      payment_status: "proses_tagihan", // Per DO model default (update model if changing)
      status: "assigned",
    });

    await tempDO.validateQuantityAgainstPO(false);

    const newDO = await db.DeliveryOrder.create(tempDO.dataValues, {
      transaction,
    });

    // Update driver/vehicle
    await db.DriverProfile.update(
      { status: "busy" },
      { where: { user_id: driver_id }, transaction }
    );
    await db.Vehicle.update(
      { status: "in_use" },
      { where: { id: vehicle_id }, transaction }
    );

    // Send push
    const driverUser = await db.User.findOne({
      where: { id: driver_id },
      attributes: ["username", "expo_push_token"],
      include: [
        {
          model: db.DriverProfile,
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

    // Let trigger update PO
    let updatedStats;
    try {
      updatedStats = await po.getRemainingAndForecast();
    } catch (err) {
      updatedStats = {}; // Fallback
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Delivery Order created successfully from Purchase Order",
      data: {
        ...newDO.toJSON(),
        financial_summary: newDO.getFinancialSummary(),
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

// Get available POs for delivery (enhanced with forecast)
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
        "load_location",
        "unload_location",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
    });

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
