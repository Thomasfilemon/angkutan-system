// src/models/purchaseOrder.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PurchaseOrder = sequelize.define(
    "PurchaseOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      po_number: { type: DataTypes.STRING, allowNull: false, unique: true },
      customer_name: { type: DataTypes.STRING, allowNull: false },
      item_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Nama barang utama sesuai kontrak PO, separated with comma",
      },
      total_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Total kuantitas barang dalam satu PO",
        validate: {
          min: 0.01,
          isDecimal: true,
        },
      },
      unit: {
        type: DataTypes.ENUM("kilogram", "ton", "kubik"),
        allowNull: false,
        defaultValue: "ton",
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Total nilai PO (auto calculated from DOs)",
        validate: {
          min: 0,
          isDecimal: true,
        },
      },
      // SIMPLIFIED: Remove coordinate fields, only keep location text
      load_location: {
        type: DataTypes.TEXT,
        allowNull: true, // FIXED: Made nullable
        comment: "Lokasi pemuatan barang (optional)",
        validate: {
          len: {
            args: [0, 500],
            msg: "Lokasi loading tidak boleh lebih dari 500 karakter",
          },
        },
      },
      unload_location: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Lokasi pembongkaran barang (optional)",
        validate: {
          len: {
            args: [0, 500],
            msg: "Lokasi unloading tidak boleh lebih dari 500 karakter",
          },
        },
      },
      order_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "confirmed",
        validate: {
          isIn: [["confirmed", "partial", "completed", "cancelled"]],
        },
      },
      notes: { type: DataTypes.TEXT },
    },
    {
      tableName: "purchase_orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      hooks: {},
    }
  );

  // NO associate method here—your inlines in index.js handle it

  // === INSTANCE METHODS ===
  PurchaseOrder.prototype.hasLocationData = function () {
    return !!(this.load_location && this.unload_location);
  };

  // 🎯 NEW: Get unit display text (unchanged)
  PurchaseOrder.prototype.getUnitDisplay = function () {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[this.unit] || this.unit;
  };

  // 🎯 NEW: Get price with unit display for UI (adjusted: since no unit_price, perhaps remove or make optional)
  PurchaseOrder.prototype.getPriceDisplay = function () {
    return `Unit: ${this.getUnitDisplay()} (Price per DO)`;
  };

  // FIXED: Method untuk hitung remaining dan forecast (match your inline alias "poDeliveryOrders")
  PurchaseOrder.prototype.getRemainingAndForecast = async function () {
    const deliveryOrders = await this.getPoDeliveryOrders(); // FIXED: Matches your inline hasMany alias

    let fulfilledActual = 0;
    let estimatedPending = 0;

    deliveryOrders.forEach((deliveryOrder) => {
      // FIXED: Renamed 'do' to 'deliveryOrder' to avoid keyword conflict
      if (deliveryOrder.status === "completed") {
        fulfilledActual += parseFloat(deliveryOrder.actual_load_quantity) || 0;
      } else {
        estimatedPending +=
          parseFloat(deliveryOrder.minimal_load_quantity) || 0;
      }
    });

    const remaining =
      this.total_quantity - (fulfilledActual + estimatedPending);
    const fulfillmentStatus =
      fulfilledActual + estimatedPending >= this.total_quantity
        ? "complete"
        : "partial";

    return {
      total_quantity: this.total_quantity,
      fulfilled_actual: fulfilledActual,
      estimated_pending: estimatedPending,
      remaining_quantity: remaining > 0 ? remaining : 0,
      current_total_forecast: this.total_amount, // Dari trigger DB
      fulfillment_status: fulfillmentStatus,
    };
  };
  return PurchaseOrder;
};
