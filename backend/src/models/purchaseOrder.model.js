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
      },
      // === TAMBAHKAN FIELD LOKASI BARU ===
      load_location: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Lokasi pemuatan barang",
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
        comment: "Lokasi pembongkaran barang",
        validate: {
          len: {
            args: [0, 500],
            msg: "Lokasi unloading tidak boleh lebih dari 500 karakter",
          },
        },
      },

      // === KOORDINAT LOADING ===
      load_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        comment: "Latitude lokasi loading",
        validate: {
          min: -90,
          max: 90,
        },
      },
      load_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        comment: "Longitude lokasi loading",
        validate: {
          min: -180,
          max: 180,
        },
      },

      // === KOORDINAT UNLOADING ===
      unload_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        comment: "Latitude lokasi unloading",
        validate: {
          min: -90,
          max: 90,
        },
      },
      unload_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        comment: "Longitude lokasi unloading",
        validate: {
          min: -180,
          max: 180,
        },
      },

      // === FIELD YANG SUDAH ADA ===
      order_date: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.STRING,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "in_progress", "completed", "cancelled"]],
        },
      },
      notes: { type: DataTypes.TEXT },
    },
    {
      tableName: "purchase_orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  // === INSTANCE METHODS ===
  PurchaseOrder.prototype.hasCompleteLocationData = function () {
    return !!(this.load_location && this.unload_location);
  };

  PurchaseOrder.prototype.hasCompleteCoordinates = function () {
    return !!(
      this.load_latitude &&
      this.load_longitude &&
      this.unload_latitude &&
      this.unload_longitude
    );
  };

  PurchaseOrder.prototype.getLoadingCoordinates = function () {
    if (this.load_latitude && this.load_longitude) {
      return {
        latitude: parseFloat(this.load_latitude),
        longitude: parseFloat(this.load_longitude),
      };
    }
    return null;
  };

  PurchaseOrder.prototype.getUnloadingCoordinates = function () {
    if (this.unload_latitude && this.unload_longitude) {
      return {
        latitude: parseFloat(this.unload_latitude),
        longitude: parseFloat(this.unload_longitude),
      };
    }
    return null;
  };

  return PurchaseOrder;
};
