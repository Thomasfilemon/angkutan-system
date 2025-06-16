// src/controllers/deliveryOrder.controller.js

const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverExpense,
  DriverProfile,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

// A generic function to update status and timestamp
const updateStatus = async (id, driverId, newStatus, timestampField) => {
  const order = await DeliveryOrder.findOne({
    where: { id, driver_id: driverId },
  });
  if (!order) {
    throw {
      status: 404,
      message: "Delivery Order not found or you are not authorized.",
    };
  }

  order[timestampField] = new Date();
  order.status = newStatus;

  await order.save();
  return order;
};

// CREATE Delivery Order by Admin user
exports.createDeliveryOrder = async (req, res, next) => {
  try {
    const {
      purchase_order_id,
      driver_id,
      vehicle_id,
      do_number,
      customer_name,
      item_name,
      quantity,
      unit_price,
      total_amount,
      load_location,
      unload_location,
      payment_status,
      payment_type,
      deposit_amount,
      invoice_amount,
      due_date,
      trip_allowance,
    } = req.body;

    // Validasi sederhana
    // CEK: Apakah driver sudah punya trip aktif (assigned, otw_to_destination, at_destination, otw_to_base)
    const activeTrip = await DeliveryOrder.findOne({
      where: {
        driver_id,
        status: {
          [Op.in]: [
            "assigned",
            "otw_to_destination",
            "at_destination",
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
            "otw_to_destination",
            "at_destination",
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
      !total_amount
    ) {
      return res.status(400).json({ message: "Data wajib belum lengkap." });
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
      quantity,
      unit_price,
      total_amount,
      load_location,
      unload_location,
      payment_status,
      payment_type,
      deposit_amount,
      invoice_amount,
      due_date,
      trip_allowance: trip_allowance || 0,
      status: "assigned", // status default saat dibuat
      surat_jalan_url,
    });

    // Set status driver & mobil ke busy/in_use (opsional, jika ada field status di tabel driver/vehicle)
    await DriverProfile.update(
      { status: "busy" },
      { where: { user_id: driver_id } }
    );
    await Vehicle.update({ status: "in_use" }, { where: { id: vehicle_id } });

    res.status(201).json(newDO);
  } catch (err) {
    next(err);
  }
};

// GET /api/delivery-orders/me - Get assigned tasks for the logged-in driver
exports.getMyDeliveryOrders = async (req, res, next) => {
  try {
    const driverId = req.user.id;

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
    const ordersWithAllowance = myOrders.map((order) => {
      const plainOrder = order.get({ plain: true });
      const expensesTotal = parseFloat(plainOrder.expenses_total) || 0;
      const tripAllowance = parseFloat(plainOrder.trip_allowance) || 0;

      return {
        ...plainOrder,
        expenses_total: expensesTotal,
        remaining_allowance: tripAllowance - expensesTotal, // Hitung sisa saldo
        driver_name:
          plainOrder.driver?.driverProfile?.full_name ||
          plainOrder.driver?.username,
        driver: undefined,
      };
    });

    res.json(ordersWithAllowance); // Kirim data yang sudah diolah
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
    res.json(deliveryOrders);
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

    // Tambahkan field kalkulasi ke dalam respons
    const responseData = {
      ...plainOrder,
      expenses_total: expensesTotal,
      remaining_allowance: tripAllowance - expensesTotal,
    };

    res.json(responseData);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/delivery-orders/:id/start
exports.startToDestination = (req, res, next) => {
  updateStatus(req.params.id, req.user.id, "otw_to_destination", "started_at")
    .then((order) =>
      res.json({ message: "Status updated to OTW to Destination", order })
    )
    .catch(next);
};

// PATCH /api/delivery-orders/:id/arrive
exports.arriveAtDestination = (req, res, next) => {
  updateStatus(
    req.params.id,
    req.user.id,
    "at_destination",
    "reached_destination_at"
  )
    .then((order) =>
      res.json({ message: "Status updated to At Destination", order })
    )
    .catch(next);
};

// PATCH /api/delivery-orders/:id/return
exports.startReturnToBase = (req, res, next) => {
  updateStatus(req.params.id, req.user.id, "otw_to_base", "started_return_at")
    .then((order) =>
      res.json({ message: "Status updated to OTW to Base", order })
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
      if (!order) throw { status: 404, message: "Delivery Order not found." };

      await order.update(
        { status: "completed", completed_at: new Date() },
        { transaction: t }
      );
      await DriverProfile.update(
        { status: "available" },
        { where: { user_id: req.user.id }, transaction: t }
      );
      await Vehicle.update(
        { status: "available" },
        { where: { id: order.vehicle_id }, transaction: t }
      );
    });
    res.json({ message: "Delivery Order completed successfully!" });
  } catch (err) {
    next(err);
  }
};
