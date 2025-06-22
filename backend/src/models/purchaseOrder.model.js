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
          isDecimal: true
        }
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Harga per unit (Rp/ton)",
        validate: {
          min: 0,
          isDecimal: true
        }
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Total nilai PO (auto calculated)",
        validate: {
          min: 0,
          isDecimal: true
        }
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
        defaultValue: DataTypes.NOW
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
            po.total_amount = parseFloat(po.unit_price) * parseFloat(po.total_quantity);
          }
        }
      }
    }
  );

  // === INSTANCE METHODS ===
  PurchaseOrder.prototype.hasLocationData = function () {
    return !!(this.load_location && this.unload_location);
  };

  PurchaseOrder.prototype.calculateTotalAmount = function () {
    if (this.unit_price && this.total_quantity) {
      return parseFloat(this.unit_price) * parseFloat(this.total_quantity);
    }
    return 0;
  };

  return PurchaseOrder;
};
