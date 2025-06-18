// src/controllers/deliveryOrder.controller.js

const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverExpense,
  DriverProfile,
  sequelize,
  Sequelize,
} = require("../models");
const { Op } = require("sequelize");

// === TAMBAHKAN UTILITY FUNCTION ===
const filterSensitiveDataForDriver = (data, userRole) => {
  if (userRole !== "driver") {
    return data; // Admin/Owner tetap bisa lihat semua data
  }

  // Function untuk remove gaji dari object
  const removeGaji = (obj) => {
    if (obj && typeof obj === "object") {
      delete obj.gaji;

      // Remove gaji dari financial_summary juga
      if (obj.financial_summary) {
        delete obj.financial_summary.gaji;
        // Recalculate total_for_driver without gaji
        obj.financial_summary.total_for_driver =
          obj.financial_summary.trip_allowance || 0;
      }
    }
    return obj;
  };

  // Handle array atau single object
  if (Array.isArray(data)) {
    return data.map((item) => removeGaji({ ...item }));
  } else {
    return removeGaji({ ...data });
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
    // CEK: Apakah driver sudah punya trip aktif (assigned, otw_to_destination, at_destination, otw_to_base)
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
            "completed",
            "cancelled",
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
            "completed",
            "cancelled",
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

// GET /api/delivery-orders/:id - Get a single order by ID
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    const order = await DeliveryOrder.findByPk(req.params.id, {
      include: [
        { model: PurchaseOrder, as: "purchaseOrder" },
        { model: Vehicle, as: "vehicle" },
        {
          model: User,
          as: "driver",
          include: { model: DriverProfile, as: "driverProfile" },
        },
        {
          model: DriverExpense, // Pastikan model DriverExpense di-import di atas
          as: "expenses", // Alias ini harus sama dengan yang ada di models/index.js
          order: [["created_at", "DESC"]], // Urutkan dari yang terbaru
        },
      ],
    });
    if (!order) {
      return res.status(404).json({ message: "Delivery Order not found" });
    }

    // --- KALKULASI SALDO DINAMIS ---
    const plainOrder = order.get({ plain: true });

    // Hitung total pengeluaran dari data yang sudah kita include
    const expensesTotal = plainOrder.expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    const tripAllowance = parseFloat(plainOrder.trip_allowance) || 0;
    const gaji = parseFloat(plainOrder.gaji) || 0;

    // Tambahkan field kalkulasi ke dalam respons
    const responseData = {
      ...plainOrder,
      expenses_total: expensesTotal,
      remaining_allowance: tripAllowance - expensesTotal,
      financial_summary: {
        trip_allowance: tripAllowance,
        gaji: gaji, // Will be filtered out below for drivers
        total_for_driver: tripAllowance + gaji, // Will be recalculated below for drivers
        expenses_total: expensesTotal,
        remaining_allowance: tripAllowance - expensesTotal,
      },
    };

    // === FILTER SENSITIVE DATA FOR DRIVERS ===
    const filteredData = filterSensitiveDataForDriver(responseData, userRole);

    res.json(filteredData);
  } catch (err) {
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
  try {
    await sequelize.transaction(async (t) => {
      const order = await DeliveryOrder.findOne({
        where: { id: req.params.id, driver_id: req.user.id },
        transaction: t,
      });

      if (!order) {
        throw { status: 404, message: "Delivery Order not found." };
      }

      // Verify current status
      if (order.status !== "otw_to_base") {
        throw {
          status: 400,
          message: `Cannot complete delivery. Current status: ${order.status}`,
        };
      }

      // Update DO Status
      await order.update(
        {
          status: "completed",
          completed_at: new Date(),
        },
        { transaction: t }
      );

      // === AUTO-REDUCE PO QUANTITY ===
      if (order.purchase_order_id && order.actual_load_quantity) {
        const po = await PurchaseOrder.findByPk(order.purchase_order_id, {
          transaction: t,
        });

        if (po) {
          // Calculate total delivered quantity for this PO
          const totalDelivered = await DeliveryOrder.sum(
            "actual_load_quantity",
            {
              where: {
                purchase_order_id: order.purchase_order_id,
                status: "completed",
                actual_load_quantity: { [Op.ne]: null },
              },
              transaction: t,
            }
          );

          console.log(
            `PO ${po.po_number}: Total delivered = ${totalDelivered}/${po.total_quantity}`
          );

          // Update PO status if fully delivered
          const remainingQuantity =
            parseFloat(po.total_quantity) - (totalDelivered || 0);
          if (remainingQuantity <= 0) {
            await po.update({ status: "completed" }, { transaction: t });
            console.log(`PO ${po.po_number} marked as completed`);
          }
        }
      }

      // Free up resources
      await DriverProfile.update(
        { status: "available" },
        { where: { user_id: req.user.id }, transaction: t }
      );

      await Vehicle.update(
        { status: "available" },
        { where: { id: order.vehicle_id }, transaction: t }
      );
    });

    res.json({
      message: "Delivery Order completed successfully!",
      status_text: "Perjalanan Selesai",
    });
  } catch (err) {
    console.error("Error completing delivery order:", err);
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
