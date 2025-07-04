// src/models/bigDoTambahan.model.js
const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const BigDoTambahan = sequelize.define(
    "BigDoTambahan",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // === FOREIGN KEY ===
      big_delivery_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Reference to Big Delivery Order",
      },

      // === BASIC INFO ===
      tambahan_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Tambahan number: TAMB-001, TAMB-002, etc.",
      },
      customer_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Customer name for this tambahan delivery",
      },
      customer_phone: { type: DataTypes.STRING(20) },
      customer_address: { type: DataTypes.TEXT },
      item_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Item being delivered for this tambahan",
      },

      // === QUANTITY & PRICING ===
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Quantity for this tambahan delivery",
        validate: { min: 0 },
      },
      unit: {
        type: DataTypes.ENUM("kilogram", "ton", "kubik"),
        allowNull: false,
        defaultValue: "ton",
        comment: "Unit for this tambahan delivery",
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: "Price per unit for this tambahan",
        validate: { min: 0 },
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: "Total amount for this tambahan delivery",
        validate: { min: 0 },
      },

      // === LOCATIONS ===
      pickup_location: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Pickup location for this tambahan",
      },
      pickup_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        validate: { min: -90, max: 90 },
      },
      pickup_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        validate: { min: -180, max: 180 },
      },
      delivery_location: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Delivery location for this tambahan",
      },
      delivery_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        validate: { min: -90, max: 90 },
      },
      delivery_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        validate: { min: -180, max: 180 },
      },

      // === STATUS & DOCUMENTS ===
      status: {
        type: DataTypes.ENUM(
          "assigned",
          "picked_up",
          "in_transit",
          "delivered",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "assigned",
      },
      pickup_photo_url: {
        type: DataTypes.STRING(500),
        comment: "Photo proof of pickup for this tambahan",
      },
      delivery_photo_url: {
        type: DataTypes.STRING(500),
        comment: "Photo proof of delivery for this tambahan",
      },

      // === TIMESTAMPS ===
      picked_up_at: { type: DataTypes.DATE },
      delivered_at: { type: DataTypes.DATE },
      created_at: {
        type: DataTypes.DATE,
        field: "created_at",
        defaultValue: Sequelize.NOW,
      },

      // === NOTES ===
      notes: { type: DataTypes.TEXT },
    },
    {
      tableName: "big_do_tambahan",
      timestamps: false,
    }
  );

  // === INSTANCE METHODS ===
  BigDoTambahan.prototype.getStatusText = function () {
    const statusMap = {
      assigned: "Ditugaskan",
      picked_up: "Sudah Diambil",
      in_transit: "Dalam Perjalanan",
      delivered: "Sudah Dikirim",
      cancelled: "Dibatalkan",
    };
    return statusMap[this.status] || this.status;
  };

  BigDoTambahan.prototype.canPickup = function () {
    return this.status === "assigned";
  };

  BigDoTambahan.prototype.canDeliver = function () {
    return this.status === "picked_up" || this.status === "in_transit";
  };

  BigDoTambahan.prototype.canCancel = function () {
    return ["assigned", "picked_up", "in_transit"].includes(this.status);
  };

  BigDoTambahan.prototype.calculateTotalAmount = function () {
    const quantity = parseFloat(this.quantity);
    const unitPrice = parseFloat(this.unit_price);
    const unit = this.unit;

    // Unit-aware calculation (same pattern as DeliveryOrder)
    switch (unit) {
      case "kilogram":
        return quantity * unitPrice;
      case "ton":
        return quantity * 1000 * unitPrice; // Convert ton to kg
      case "kubik":
        return quantity * unitPrice; // Direct kubik pricing
      default:
        return quantity * unitPrice;
    }
  };

  BigDoTambahan.prototype.getUnitDisplay = function () {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[this.unit] || this.unit;
  };

  BigDoTambahan.prototype.getFinancialSummary = function () {
    return {
      quantity: parseFloat(this.quantity) || 0,
      unit: this.unit,
      unit_display: this.getUnitDisplay(),
      unit_price: parseFloat(this.unit_price) || 0,
      calculated_amount: this.calculateTotalAmount(),
      total_amount: parseFloat(this.total_amount) || 0,
      customer_name: this.customer_name,
    };
  };

  // 🎯 Static method for generating Tambahan numbers
  BigDoTambahan.generateTambahanNumber = async function (bigDoId) {
    const tambahanCount = await BigDoTambahan.count({
      where: { big_delivery_order_id: bigDoId },
    });

    return `TAMB-${(tambahanCount + 1).toString().padStart(3, "0")}`;
  };

  return BigDoTambahan;
};
