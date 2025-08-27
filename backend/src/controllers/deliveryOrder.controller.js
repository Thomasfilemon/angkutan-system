// src/controllers/deliveryOrder.controller.js

const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverExpense,
  DriverProfile,
  DepositGroup, // Add DepositGroup
  DepositGroupMember, // Add DepositGroupMember
  DeliveryOrderAdjustments,
  DeliveryOrderPayments, // <<< FIX: Make sure this is imported
  sequelize,
  Sequelize,
} = require("../models");
const { Op } = require("sequelize");

// === TAMBAHKAN UTILITY FUNCTION ===
// Updated filter function (from previous response, kept for consistency)
const filterSensitiveDataForDriver = (data, userRole) => {
  if (userRole !== "driver") {
    return data; // Admin/Owner get full data
  }

  const removeSensitiveFields = (obj) => {
    if (obj && typeof obj === "object") {
      // Remove truly sensitive fields (adjust as needed)
      delete obj.internal_notes;
      if (obj.financial_summary) {
        obj.financial_summary.total_for_driver =
          (obj.financial_summary.trip_allowance || 0) +
          (obj.financial_summary.gaji || 0) +
          (Array.isArray(obj.financial_summary.additional_allowance)
            ? obj.financial_summary.additional_allowance.reduce((sum, a) => sum + a, 0)
            : 0);
      }
    }
    return obj;
  };

  if (Array.isArray(data)) {
    return data.map((item) => removeSensitiveFields({ ...item }));
  } else {
    return removeSensitiveFields({ ...data });
  }
};

// GET /api/delivery-orders/:id
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    console.log("getDeliveryOrderById - req.user:", req.user);
    console.log("getDeliveryOrderById - req.params:", req.params);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!req.user.role) {
      console.error("User role is undefined in getDeliveryOrderById:", req.user);
      return res.status(500).json({ message: "User role is not defined" });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    const order = await DeliveryOrder.findByPk(req.params.id, {
      include: [
        { model: PurchaseOrder, as: "purchaseOrder", attributes: ["unit"] },
        { model: Vehicle, as: "vehicle" },
        {
          model: User,
          as: "driver",
          include: { model: DriverProfile, as: "driverProfile" },
        },
        {
          model: DriverExpense,
          as: "expenses",
          order: [["created_at", "DESC"]],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Delivery Order not found" });
    }

    if (userRole === "driver" && order.driver_id !== userId) {
      return res.status(403).json({
        message: "Access denied. You can only view your own delivery orders.",
      });
    }

    const plainOrder = order.get({ plain: true });
    console.log("Raw plainOrder:", plainOrder); // Debug raw data

    // Calculate financial details
    const expensesTotal = plainOrder.expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    const tripAllowance = parseFloat(plainOrder.trip_allowance) || 0;
    const gaji = parseFloat(plainOrder.gaji) || 0;
    const additionalAllowance = Array.isArray(plainOrder.additional_allowance)
      ? plainOrder.additional_allowance.map(a => parseFloat(a) || 0)
      : [];
    const additionalAllowanceTotal = additionalAllowance.reduce(
      (sum, amount) => sum + amount,
      0
    );
    const paymentNotes = plainOrder.payment_notes || '';
    const unit = plainOrder.unit || plainOrder.purchaseOrder?.unit || "ton";

    console.log("Processed additional_allowance:", additionalAllowance);
    console.log("Processed payment_notes:", paymentNotes);

    const responseData = {
      ...plainOrder,
      additional_allowance: additionalAllowance,
      payment_notes: paymentNotes,
      unit,
      expenses_total: expensesTotal,
      remaining_allowance: tripAllowance + additionalAllowanceTotal - expensesTotal,
      financial_summary: {
        trip_allowance: tripAllowance,
        gaji: gaji,
        additional_allowance: additionalAllowance,
        total_for_driver: tripAllowance + gaji + additionalAllowanceTotal,
        expenses_total: expensesTotal,
        remaining_allowance: tripAllowance + additionalAllowanceTotal - expensesTotal,
        unit,
      },
    };

    const filteredData = filterSensitiveDataForDriver(responseData, userRole);
    console.log("Final response data:", filteredData); // Debug final response

    res.json(filteredData);
  } catch (err) {
    console.error("Error in getDeliveryOrderById:", err);
    next(err);
  }
};

// CREATE Delivery Order by Admin user
exports.createDeliveryOrder = async (req, res, next) => {
  try {
    // TAMBAHKAN DEBUG LOGGING
    console.log("=== DELIVERY ORDER CREATION DEBUG ===");
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    console.log("=====================================");
    const {
      purchase_order_id,
      driver_id,
      vehicle_id,
      do_number,
      customer_name,
      item_name,
      minimal_load_quantity, // <-- RENAMED
      unit_price,
      total_amount,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status,
      payment_type,
      deposit_amount,
      invoice_amount,
      due_date,
      trip_allowance,
      gaji, // <-- FIELD BARU
    } = req.body;

    // Validasi sederhana
    // CEK: Apakah driver sudah punya trip aktif (assigned, otw_to_load_location, at_load_location, otw_to_unload_location, at_unload_location, otw_to_base)
    const activeTrip = await DeliveryOrder.findOne({
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
    if (activeTrip) {
      return res.status(400).json({
        message: "Driver ini masih menjalani trip lain yang belum selesai!",
      });
    }

    // CEK: Apakah vehicle sudah punya trip aktif
    const activeVehicle = await DeliveryOrder.findOne({
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
    if (activeVehicle) {
      return res.status(400).json({
        message: "Mobil ini masih dipakai untuk trip lain yang belum selesai!",
      });
    }

    if (
      !purchase_order_id ||
      !driver_id ||
      !vehicle_id ||
      !do_number ||
      !customer_name ||
      !minimal_load_quantity ||
      !trip_allowance ||
      !gaji
    ) {
      return res.status(400).json({
        message: "Data wajib belum lengkap.",
        missing_fields: {
          purchase_order_id: !purchase_order_id,
          driver_id: !driver_id,
          vehicle_id: !vehicle_id,
          do_number: !do_number,
          customer_name: !customer_name,
          minimal_load_quantity: !minimal_load_quantity,
          trip_allowance: !trip_allowance,
          gaji: !gaji,
        },
      });
    }

    // Handle file upload (surat jalan)
    let surat_jalan_url = null;
    if (req.file) {
      surat_jalan_url = req.file.path.replace(/\\/g, "/");
    }

    // Buat DeliveryOrder baru
    const newDO = await DeliveryOrder.create({
      purchase_order_id,
      driver_id,
      vehicle_id,
      do_number,
      customer_name,
      item_name,
      minimal_load_quantity: minimal_load_quantity || 0,
      unit_price: unit_price || 0,
      total_amount: total_amount || 0,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status: payment_status || "proses_tagihan",
      payment_type,
      deposit_amount: deposit_amount || 0,
      invoice_amount,
      due_date,
      trip_allowance: trip_allowance || 0,
      gaji: gaji || 0,
      status: "assigned",
    });

    // Set status driver & mobil ke busy/in_use (opsional, jika ada field status di tabel driver/vehicle)
    await DriverProfile.update(
      { status: "busy" },
      { where: { user_id: driver_id } }
    );
    await Vehicle.update({ status: "in_use" }, { where: { id: vehicle_id } });

    res.status(201).json({
      ...newDO.toJSON(),
      financial_summary: newDO.getFinancialSummary(),
    });
  } catch (err) {
    console.error("Error creating delivery order:", err);
    next(err);
  }
};

// GET /api/delivery-orders/me - Get assigned tasks for the logged-in driver
exports.getMyDeliveryOrders = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const userRole = req.user.role;

    const myOrders = await DeliveryOrder.findAll({
      where: { driver_id: driverId },
      attributes: {
        include: [
          [
            // Subquery untuk menjumlahkan semua expense yang terkait dengan DO ini
            sequelize.literal(`(
              SELECT COALESCE(SUM(amount), 0)
              FROM driver_expenses AS de
              WHERE
                de.delivery_order_id = "DeliveryOrder".id
            )`),
            "expenses_total", // Nama alias untuk total expense
          ],
        ],
      },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "po_number"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "license_plate", "type"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "username"],
          include: [
            {
              model: DriverProfile,
              as: "driverProfile",
              attributes: ["full_name"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Proses data untuk menambahkan sisa saldo
    // Update response untuk include financial data
    const ordersWithAllowance = myOrders.map((order) => {
      const plainOrder = order.get({ plain: true });
      const expensesTotal = parseFloat(plainOrder.expenses_total) || 0;
      const tripAllowance = parseFloat(plainOrder.trip_allowance) || 0;
      const gaji = parseFloat(plainOrder.gaji) || 0;

      return {
        ...plainOrder,
        expenses_total: expensesTotal,
        remaining_allowance: tripAllowance - expensesTotal,
        financial_summary: {
          trip_allowance: tripAllowance,
          gaji: gaji,
          total_for_driver: tripAllowance + gaji,
          expenses_total: expensesTotal,
          remaining_allowance: tripAllowance - expensesTotal,
        },
        driver_name:
          plainOrder.driver?.driverProfile?.full_name ||
          plainOrder.driver?.username,
        driver: undefined,
      };
    });

    // === FILTER SENSITIVE DATA FOR DRIVERS ===
    const filteredOrders = filterSensitiveDataForDriver(
      ordersWithAllowance,
      userRole
    );

    res.json(filteredOrders); // Kirim data yang sudah diolah
  } catch (err) {
    console.error("Error in getMyDeliveryOrders:", err);
    next(err);
  }
};

// GET /api/delivery-orders - Get all orders (for admins) or filtered orders
exports.getAllDeliveryOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const user = req.user;

    const options = {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["license_plate", "type"],
        },
        {
          model: User,
          as: "driver",
          include: {
            model: DriverProfile,
            as: "driverProfile",
            attributes: ["full_name"],
          },
        },
      ],
      order: [["created_at", "DESC"]],
      where: {},
    };

    if (status) {
      options.where.status = { [Op.in]: status.split(",") };
    }

    if (user.role === "driver") {
      options.where.driver_id = user.id;
    }

    const deliveryOrders = await DeliveryOrder.findAll(options);
    // === FILTER SENSITIVE DATA FOR DRIVERS ===
    const filteredOrders = filterSensitiveDataForDriver(
      deliveryOrders.map((order) => order.get({ plain: true })),
      user.role
    );
    res.json(filteredOrders);
  } catch (err) {
    console.error("Error in getAllDeliveryOrders:", err);
    next(err);
  }
};

// GET /api/delivery-orders/active - Get all active delivery orders
exports.getActiveDeliveryOrders = async (req, res, next) => {
  try {
    const ACTIVE_STATUSES = [
      "assigned",
      "otw_to_load_location",
      "at_load_location",
      "otw_to_unload_location",
      "at_unload_location",
      "otw_to_base",
    ];

    const user = req.user;

    const options = {
      where: { status: { [Op.in]: ACTIVE_STATUSES } },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["license_plate", "type"],
        },
        {
          model: User,
          as: "driver",
          include: {
            model: DriverProfile,
            as: "driverProfile",
            attributes: ["full_name"],
          },
        },
      ],
      order: [["created_at", "DESC"]],
    };

    // If driver, only show their own DOs
    if (user.role === "driver") {
      options.where.driver_id = user.id;
    }

    const activeDOs = await DeliveryOrder.findAll(options);

    // Filter sensitive data for drivers
    const filtered = filterSensitiveDataForDriver(
      activeDOs.map((order) => order.get({ plain: true })),
      user.role
    );

    res.json(filtered);
  } catch (err) {
    console.error("Error in getActiveDeliveryOrders:", err);
    next(err);
  }
};

// GET /api/delivery-orders/:id - Get a single order by ID
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    // Debug logging
    console.log("getDeliveryOrderById - req.user:", req.user);
    console.log("getDeliveryOrderById - req.params:", req.params);

    // Validate req.user
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!req.user.role) {
      console.error(
        "User role is undefined in getDeliveryOrderById:",
        req.user
      );
      return res.status(500).json({
        message: "User role is not defined",
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    const order = await DeliveryOrder.findByPk(req.params.id, {
      include: [
        { model: PurchaseOrder, as: "purchaseOrder", attributes: ["unit"] },
        { model: Vehicle, as: "vehicle" },
        {
          model: User,
          as: "driver",
          include: { model: DriverProfile, as: "driverProfile" },
        },
        {
          model: DriverExpense,
          as: "expenses",
          order: [["created_at", "DESC"]],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Delivery Order not found" });
    }

    // Authorization check
    if (userRole === "driver" && order.driver_id !== userId) {
      return res.status(403).json({
        message: "Access denied. You can only view your own delivery orders.",
      });
    }

    const plainOrder = order.get({ plain: true });

    // Calculate financial details
    const expensesTotal = plainOrder.expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    const tripAllowance = parseFloat(plainOrder.trip_allowance) || 0;
    const gaji = parseFloat(plainOrder.gaji) || 0;
    const additionalAllowance = Array.isArray(plainOrder.additional_allowance)
      ? plainOrder.additional_allowance.map(a => parseFloat(a) || 0)
      : [];
    const additionalAllowanceTotal = additionalAllowance.reduce(
      (sum, amount) => sum + amount,
      0
    );
    const unit = plainOrder.unit || plainOrder.purchaseOrder?.unit || "ton";

    const responseData = {
      ...plainOrder,
      additional_allowance: additionalAllowance,
      payment_notes: plainOrder.payment_notes || '',
      unit,
      expenses_total: expensesTotal,
      remaining_allowance: tripAllowance + additionalAllowanceTotal - expensesTotal,
      financial_summary: {
        trip_allowance: tripAllowance,
        gaji: gaji,
        additional_allowance: additionalAllowance,
        total_for_driver: tripAllowance + gaji + additionalAllowanceTotal,
        expenses_total: expensesTotal,
        remaining_allowance: tripAllowance + additionalAllowanceTotal - expensesTotal,
        unit,
      },
    };

    // Filter sensitive data for drivers
    const filteredData = filterSensitiveDataForDriver(responseData, userRole);

    res.json(filteredData);
  } catch (err) {
    console.error("Error in getDeliveryOrderById:", err);
    next(err);
  }
};

// PATCH /api/delivery-orders/:id/start
exports.startToDestination = (req, res, next) => {
  updateStatus(
    req.params.id,
    req.user.id,
    "otw_to_load_location", // ✅ Update ke enum baru
    "departed_to_load_location_at" // ✅ Update field timestamp baru
  )
    .then((order) =>
      res.json({
        message: "Status updated to OTW to Load Location",
        order,
        status_text: "Menuju Lokasi Muat",
      })
    )
    .catch(next);
};

// PATCH /api/delivery-orders/:id/arrive
exports.arriveAtDestination = (req, res, next) => {
  updateStatus(
    req.params.id,
    req.user.id,
    "at_unload_location", // ✅ Update ke enum baru
    "arrived_at_unload_location_at" // ✅ Update field timestamp baru
  )
    .then((order) =>
      res.json({
        message: "Status updated to At Unload Location",
        order,
        status_text: "Di Lokasi Bongkar",
      })
    )
    .catch(next);
};

// PATCH /api/delivery-orders/:id/return
exports.startReturnToBase = (req, res, next) => {
  updateStatus(
    req.params.id,
    req.user.id,
    "otw_to_base", // ✅ Sudah benar
    "departed_from_unload_location_at" // ✅ Update field timestamp baru
  )
    .then((order) =>
      res.json({
        message: "Status updated to OTW to Base",
        order,
        status_text: "Perjalanan Pulang",
      })
    )
    .catch(next);
};

// PATCH /api/delivery-orders/:id/complete
exports.completeDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { notes } = req.body || {}; 
    const driverId = req.user.id;

    const order = await DeliveryOrder.findOne({
      where: { id: id, driver_id: driverId },
      include: [{
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "deposit_group_id"]
      }],
      transaction: transaction,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ message: "Delivery Order not found or not assigned to you." });
    }

    if (order.status !== "otw_to_base") {
      await transaction.rollback();
      return res.status(400).json({
          message: `Cannot complete delivery. Current status: ${order.status}.`,
      });
    }
    
    if (!order.actual_load_quantity) {
        await transaction.rollback();
        return res.status(400).json({ message: "Cannot complete order. Actual load quantity has not been confirmed." });
    }

    const dgMember = await DepositGroupMember.findOne({
        where: { delivery_order_id: id },
        include: [{ model: DepositGroup, as: 'depositGroup' }], 
        transaction,
    });
    
//  // Start of changes
    let paymentStatusUpdate = {};
    let grp = null;

    if (dgMember && dgMember.depositGroup) {
        grp = dgMember.depositGroup;
        const actualQty = parseFloat(order.actual_load_quantity);
        const minimalQty = parseFloat(order.minimal_load_quantity);
        const unitPrice = parseFloat(order.unit_price);
        const priceForMinimalQty = minimalQty * unitPrice;
        const selisihQty = actualQty - minimalQty;

        // Only deduct for the minimal quantity from the balance
        grp.balance = parseFloat(grp.balance) - priceForMinimalQty;
        grp.remaining_quantity = parseFloat(grp.remaining_quantity) - actualQty;

        if (selisihQty > 0) {
            // There is a selisih, mark for future invoicing
            paymentStatusUpdate = {
                payment_status: 'proses_tagihan', // Not lunas yet
                payment_confirmation_status: 'confirmed',
                payment_confirmation_at: new Date()
            };
            // The selisih amount will be handled by the generateSelisih function
        } else {
            // No selisih, DO is considered paid from deposit
            paymentStatusUpdate = {
                payment_status: 'lunas',
                payment_confirmation_status: 'confirmed',
                payment_confirmation_at: new Date()
            };
        }

        if (grp.remaining_quantity <= 0) grp.status = 'fulfilled';
        await grp.save({ transaction });
        await dgMember.update({ quantity: actualQty }, { transaction });

        // Create a payment record only for the minimal quantity amount
        await DeliveryOrderPayments.create({
            delivery_order_id: id,
            payment_amount: priceForMinimalQty,
            payment_type: 'transfer', // Assuming 'transfer' as a valid type
            payment_date: new Date(),
            notes: `Auto-payment from Deposit Group: ${grp.group_name} (minimal qty)`,
            received_by: req.user?.id,
            created_by: req.user?.id,
        }, { transaction });
    }

    await order.update({
        status: "completed",
        completed_at: new Date(),
        notes: notes || order.notes,
        ...paymentStatusUpdate
    }, { transaction: transaction });

    // Free up driver and vehicle
    await DriverProfile.update(
      { status: "available" },
      { where: { user_id: driverId }, transaction: transaction }
    );
    await Vehicle.update(
      { status: "available" },
      { where: { id: order.vehicle_id }, transaction: transaction }
    );

    await transaction.commit();

    res.json({
      message: "Delivery Order completed successfully!",
      status_text: "Perjalanan Selesai",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error completing delivery order from mobile:", err);
    next(err);
  }
};

// PATCH /api/delivery-orders/:id/arrive-at-load
exports.arriveAtLoadLocation = (req, res, next) => {
  updateStatus(
    req.params.id,
    req.user.id,
    "at_load_location",
    "arrived_at_load_location_at"
  )
    .then((order) =>
      res.json({
        message: "Status updated to At Load Location",
        order,
        status_text: "Di Lokasi Muat",
      })
    )
    .catch(next);
};

// === UPDATE HELPER FUNCTION updateStatus ===
const updateStatus = async (orderId, driverId, newStatus, timestampField) => {
  try {
    const order = await DeliveryOrder.findOne({
      where: { id: orderId, driver_id: driverId },
    });

    if (!order) {
      throw { status: 404, message: "Delivery Order tidak ditemukan." };
    }

    // Status validation mapping
    const validTransitions = {
      assigned: ["otw_to_load_location"],
      otw_to_load_location: ["at_load_location"],
      at_load_location: ["otw_to_unload_location"], // Setelah confirm load
      otw_to_unload_location: ["at_unload_location"],
      at_unload_location: ["otw_to_base"],
      otw_to_base: ["completed"],
      completed: [],
      cancelled: [],
    };

    const allowedTransitions = validTransitions[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw {
        status: 400,
        message: `Invalid status transition from ${order.status} to ${newStatus}`,
      };
    }

    const updateData = {
      status: newStatus,
      [timestampField]: new Date(),
    };

    await order.update(updateData);

    return order;
  } catch (error) {
    throw error;
  }
};
