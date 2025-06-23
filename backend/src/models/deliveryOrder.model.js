// src/models/deliveryOrder.model.js
const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrder = sequelize.define(
    "DeliveryOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // === FOREIGN KEYS ===
      purchase_order_id: { type: DataTypes.INTEGER },
      driver_id: { type: DataTypes.INTEGER },
      vehicle_id: { type: DataTypes.INTEGER },

      // === BASIC INFO ===
      do_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      item_name: { type: DataTypes.STRING(100) },

      // === QUANTITY FIELDS ===
      minimal_load_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Minimal quantity yang harus diangkut (dari admin)",
        validate: { min: 0 },
      },
      actual_load_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Actual quantity yang diangkut (dari driver)",
        validate: { min: 0 },
      },

      // === FINANCIAL FIELDS ===
      unit_price: { type: DataTypes.DECIMAL },
      total_amount: { type: DataTypes.DECIMAL, allowNull: false },
      trip_allowance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Uang operasional (bensin, tol, dll)",
        validate: { min: 0 },
      },
      gaji: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Upah/bayaran untuk driver",
        validate: { min: 0 },
      },
      // NEW: Admin-only profit field
      ongkosan: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Pendapatan/keuntungan dari trip (hanya untuk admin/web)",
        validate: { min: 0 },
      },

      // === LOCATION FIELDS ===
      load_location: { type: DataTypes.TEXT },
      load_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        validate: { min: -90, max: 90 },
      },
      load_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        validate: { min: -180, max: 180 },
      },
      unload_location: { type: DataTypes.TEXT },
      unload_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        validate: { min: -90, max: 90 },
      },
      unload_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        validate: { min: -180, max: 180 },
      },

      // === DOCUMENT FIELD ===
      surat_jalan_photo_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Photo surat jalan yang diambil driver di lokasi muat",
      },

      // === PAYMENT FIELDS ===
      payment_status: {
        type: DataTypes.STRING(20),
        defaultValue: "proses_tagihan",
        validate: { isIn: [["lunas", "deposit", "proses_tagihan"]] },
      },
      payment_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["cash", "transfer", "deposit"]] },
      },
      deposit_amount: { type: DataTypes.DECIMAL, defaultValue: 0 },
      invoice_amount: { type: DataTypes.DECIMAL },
      due_date: { type: DataTypes.DATE },

      // === STATUS ===
      status: {
        type: DataTypes.ENUM(
          "assigned",
          "otw_to_load_location",
          "at_load_location",
          "otw_to_unload_location",
          "at_unload_location",
          "otw_to_base",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "assigned",
      },

      // === TIMESTAMPS ===
      created_at: {
        type: DataTypes.DATE,
        field: "created_at",
        defaultValue: Sequelize.NOW,
      },
      departed_to_load_location_at: { type: DataTypes.DATE },
      arrived_at_load_location_at: { type: DataTypes.DATE },
      departed_from_load_location_at: { type: DataTypes.DATE },
      arrived_at_unload_location_at: { type: DataTypes.DATE },
      departed_from_unload_location_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
    },
    {
      tableName: "delivery_orders",
      timestamps: false,
      // Add scope to hide ongkosan from mobile API
      scopes: {
        mobile: {
          attributes: { exclude: ["ongkosan"] },
        },
        web: {
          // Include all fields for web
        },
      },
    }
  );

  // === INSTANCE METHODS ===
  DeliveryOrder.prototype.getStatusText = function () {
    const statusMap = {
      assigned: "Ditugaskan",
      otw_to_load_location: "Menuju Lokasi Muat",
      at_load_location: "Di Lokasi Muat",
      otw_to_unload_location: "Menuju Lokasi Bongkar",
      at_unload_location: "Di Lokasi Bongkar",
      otw_to_base: "Perjalanan Pulang",
      completed: "Selesai",
      cancelled: "Dibatalkan",
    };
    return statusMap[this.status] || this.status;
  };

  DeliveryOrder.prototype.canConfirmLoad = function () {
    return this.status === "at_load_location";
  };

  DeliveryOrder.prototype.hasActualLoadData = function () {
    return !!(this.actual_load_quantity && this.surat_jalan_photo_url);
  };

  DeliveryOrder.prototype.getLoadProgress = function () {
    if (this.actual_load_quantity && this.minimal_load_quantity) {
      const actual = parseFloat(this.actual_load_quantity);
      const minimal = parseFloat(this.minimal_load_quantity);
      return {
        percentage: (actual / minimal) * 100,
        excess: actual > minimal ? actual - minimal : 0,
        shortage: actual < minimal ? minimal - actual : 0,
        meets_minimum: actual >= minimal,
      };
    }
    return null;
  };

  DeliveryOrder.prototype.getTotalDriverPayment = function () {
    const allowance = parseFloat(this.trip_allowance) || 0;
    const salary = parseFloat(this.gaji) || 0;
    return allowance + salary;
  };

  DeliveryOrder.prototype.getFinancialSummary = function () {
    return {
      trip_allowance: parseFloat(this.trip_allowance) || 0,
      gaji: parseFloat(this.gaji) || 0,
      total_for_driver: this.getTotalDriverPayment(),
      total_amount: parseFloat(this.total_amount) || 0,
      ongkosan: parseFloat(this.ongkosan) || 0,
      net_profit:
        (parseFloat(this.ongkosan) || 0) - this.getTotalDriverPayment(),
    };
  };

  return DeliveryOrder;
};
