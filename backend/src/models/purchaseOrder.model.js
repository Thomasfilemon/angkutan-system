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
        comment: "Nama barang utama sesuai kontrak PO",
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
      quantity_mutasi: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        defaultValue: () => [], // Ensures a fresh array for each new record
        comment: "Riwayat perubahan kuantitas",
      },
      unit: {
        type: DataTypes.ENUM("kilogram", "ton", "kubik"),
        allowNull: false,
        defaultValue: "ton",
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Harga per unit (Rp/ton)",
        validate: {
          min: 0,
          isDecimal: true,
        },
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Total nilai PO (auto calculated)",
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
        allowNull: true, // FIXED: Made nullable
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
      hooks: {
        beforeSave: (po) => {
          // Auto-calculate total_amount if unit_price and total_quantity are provided
          if (po.unit_price && po.total_quantity) {
            const quantity = parseFloat(po.total_quantity);
            const unitPrice = parseFloat(po.unit_price);

            switch (po.unit) {
              case "kilogram":
                po.total_amount = quantity * unitPrice;
                break;
              case "ton":
                po.total_amount = quantity * 1000 * unitPrice; // Convert ton to kg
                break;
              case "kubik":
                po.total_amount = quantity * unitPrice; // Direct kubik pricing
                break;
              default:
                po.total_amount = quantity * unitPrice;
            }
          }
        },
      },
    }
  );

  // === INSTANCE METHODS ===
  PurchaseOrder.prototype.hasLocationData = function () {
    return !!(this.load_location && this.unload_location);
  };

  PurchaseOrder.prototype.calculateTotalAmount = function () {
    if (this.unit_price && this.total_quantity) {
      const quantity = parseFloat(this.total_quantity);
      const unitPrice = parseFloat(this.unit_price);

      switch (this.unit) {
        case "kilogram":
          return quantity * unitPrice;
        case "ton":
          return quantity * 1000 * unitPrice; // Convert ton to kg
        case "kubik":
          return quantity * unitPrice; // Direct kubik pricing
        default:
          return quantity * unitPrice;
      }
    }
    return 0;
  };

  // 🎯 NEW: Get unit display text
  PurchaseOrder.prototype.getUnitDisplay = function () {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[this.unit] || this.unit;
  };

  // 🎯 NEW: Get price with unit display for UI
  PurchaseOrder.prototype.getPriceDisplay = function () {
    const unitPrice = parseFloat(this.unit_price) || 0;
    const unitDisplay = this.getUnitDisplay();

    if (this.unit === "ton") {
      // Show both per kg and per ton prices
      const pricePerTon = unitPrice * 1000;
      return `Rp ${unitPrice.toLocaleString(
        "id-ID"
      )}/${unitDisplay} (Rp ${pricePerTon.toLocaleString("id-ID")}/ton)`;
    }

    return `Rp ${unitPrice.toLocaleString("id-ID")}/${unitDisplay}`;
  };

  return PurchaseOrder;
};
