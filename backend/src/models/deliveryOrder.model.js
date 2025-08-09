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
      do_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "Human-readable name for the delivery order",
      },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      // Item name diambil dari pilihan yang ada di PO (di tabel PO, nama item dipisah menggunakan koma)
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
      unit: {
        type: DataTypes.ENUM("kilogram", "ton", "kubik"),
        allowNull: false,
        defaultValue: "ton",
        comment: "Unit satuan barang (inherited from PO)",
      },
      // === FINANCIAL FIELDS ===
      unit_price: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        defaultValue: 0,
        comment: "Price per unit of the delivery order",
      },
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
      ongkosan: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Pendapatan/keuntungan dari trip (hanya untuk admin/web)",
        validate: { min: 0 },
      },

      final_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: null,
        comment: "Finalized amount after user input or adjustments",
      },

      is_amount_finalized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
        comment: "Photo surat jalan yang diambil driver di lokasi muat",
      },

      // === PAYMENT FIELDS ===
      payment_status: {
        type: DataTypes.STRING(30),
        defaultValue: "awaiting_confirmation",
        validate: {
          isIn: [
            ["awaiting_confirmation", "lunas", "deposit", "proses_tagihan"],
          ],
        },
      },
      payment_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["cash", "transfer", "deposit"]] },
      },
      deposit_amount: { type: DataTypes.DECIMAL, defaultValue: 0 },
      invoice_amount: { type: DataTypes.DECIMAL },
      due_date: { type: DataTypes.DATE },

      payment_confirmation_status: {
        type: DataTypes.STRING(30),
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "awaiting_confirmation", "confirmed"]],
        },
        comment: "Status konfirmasi untuk billing process",
      },
      payment_confirmation_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when payment was confirmed for billing",
      },
      payment_confirmed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "User ID who confirmed the payment for billing",
      },

      // Add payment notes field
      payment_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Additional payment notes",
      },

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

      has_generated_selisih: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
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

  // Payment confirmation methods
  DeliveryOrder.prototype.canConfirmForBilling = function () {
    return (
      this.status === "completed" &&
      this.payment_confirmation_status !== "confirmed"
    );
  };

  DeliveryOrder.prototype.isConfirmedForBilling = function () {
    return this.payment_confirmation_status === "confirmed";
  };

  DeliveryOrder.prototype.canCreateInvoice = function () {
    return this.payment_confirmation_status === "confirmed";
  };

  DeliveryOrder.prototype.canRecordPayment = function () {
    return (
      this.payment_confirmation_status === "confirmed" &&
      this.invoices &&
      this.invoices.length > 0
    );
  };

  // financial summary with confirmation status
  DeliveryOrder.prototype.getFinancialSummary = function () {
    const actualTotalAmount = this.calculateActualTotalAmount();
    const finalAmount = actualTotalAmount;

    return {
      trip_allowance: parseFloat(this.trip_allowance) || 0,
      gaji: parseFloat(this.gaji) || 0,
      total_for_driver: this.getTotalDriverPayment(),
      minimal_total_amount: parseFloat(this.total_amount) || 0,
      actual_total_amount: actualTotalAmount,
      final_amount: finalAmount,
      ongkosan: parseFloat(this.ongkosan) || 0,
      net_profit:
        this.total_amount - this.getTotalDriverPayment() ||
        actualTotalAmount - this.getTotalDriverPayment(),
      unit: this.unit,
      unit_display: this.getUnitDisplay(),

      // Payment status info
      payment_confirmation_status: this.payment_confirmation_status,
      can_confirm_billing: this.canConfirmForBilling(),
      can_create_invoice: this.canCreateInvoice(),
      can_record_payment: this.canRecordPayment(),
    };
  };

  // Get payment confirmation status display
  DeliveryOrder.prototype.getPaymentConfirmationStatusText = function () {
    const statusMap = {
      pending: "Menunggu Konfirmasi",
      awaiting_confirmation: "Menunggu Konfirmasi",
      confirmed: "Dikonfirmasi untuk Tagihan",
    };
    return (
      statusMap[this.payment_confirmation_status] ||
      this.payment_confirmation_status
    );
  };

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

  DeliveryOrder.prototype.calculateActualTotalAmount = function () {
    const actualQuantity =
      parseFloat(this.actual_load_quantity) ||
      parseFloat(this.minimal_load_quantity) ||
      0;
    const unitPrice = parseFloat(this.unit_price) || 0;

    switch (this.unit) {
      case "kilogram":
        return actualQuantity * unitPrice;
      case "ton":
        return actualQuantity * unitPrice;
      case "kubik":
        return actualQuantity * unitPrice;
      default:
        return actualQuantity * unitPrice;
    }
  };

  // Get unit display text
  DeliveryOrder.prototype.getUnitDisplay = function () {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[this.unit] || this.unit;
  };

  DeliveryOrder.prototype.isMainDOOfBigDO = function () {
    return !!this.bigDeliveryOrderAsMain;
  };

  DeliveryOrder.prototype.getBigDOContext = function () {
    if (this.bigDeliveryOrderAsMain) {
      return {
        type: "big_do_main",
        message: "Main DO of Big Delivery Order",
        big_do: this.bigDeliveryOrderAsMain,
      };
    }
    return {
      type: "standalone",
      message: "Standalone Delivery Order",
    };
  };

  DeliveryOrder.prototype.validateQuantityAgainstPO = async function (
    isUpdate = false
  ) {
    const po = await this.getPurchaseOrder();
    if (!po) throw new Error("PO not found for this DO");

    const dos = await po.getPoDeliveryOrders({
      where: { id: { [Sequelize.Op.ne]: isUpdate ? this.id : null } },
    });

    let fulfilled = 0;
    dos.forEach((d) => {
      fulfilled +=
        d.status === "completed"
          ? parseFloat(d.actual_load_quantity) || 0
          : parseFloat(d.minimal_load_quantity) || 0;
    });

    const remaining = po.total_quantity - fulfilled;

    if (this.minimal_load_quantity > remaining) {
      throw new Error(
        `Minimal quantity exceeds remaining PO quantity: ${remaining} available`
      );
    }
    if (this.actual_load_quantity && this.actual_load_quantity > remaining) {
      throw new Error(
        `Actual quantity exceeds remaining PO quantity: ${remaining} available`
      );
    }

    return true;
  };
  return DeliveryOrder;
};
