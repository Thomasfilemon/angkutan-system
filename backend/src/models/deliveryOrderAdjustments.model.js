// src/models/deliveryOrderAdjustments.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrderAdjustments = sequelize.define(
    "DeliveryOrderAdjustments",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      delivery_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "delivery_orders",
          key: "id",
        },
      },
      adjustment_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: {
            args: [
              ["price_override", "uj_tambahan", "penalty", "bonus", "incident"],
            ],
            msg: "Adjustment type must be price_override, uj_tambahan, penalty, bonus, or incident",
          },
        },
        comment: "Type of adjustment being made",
      },
      original_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Original amount before adjustment",
      },
      adjustment_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: "New amount after adjustment",
      },
      final_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
        comment: "Final calculated amount",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Reason for adjustment is required",
          },
        },
      },
      approved_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
    },
    {
      tableName: "delivery_order_adjustments",
      timestamps: false,
      indexes: [
        {
          fields: ["delivery_order_id"],
        },
        {
          fields: ["adjustment_type"],
        },
        {
          fields: ["created_at"],
        },
      ],
    }
  );

  // Instance methods
  DeliveryOrderAdjustments.prototype.getAdjustmentTypeText = function () {
    const typeMap = {
      price_override: "Override Harga",
      uj_tambahan: "Uang Jalan Tambahan",
      penalty: "Penalti",
      bonus: "Bonus",
      incident: "Kasus Khusus (Kecelakaan)",
    };
    return typeMap[this.adjustment_type] || this.adjustment_type;
  };

  DeliveryOrderAdjustments.prototype.getFormattedOriginalAmount = function () {
    if (!this.original_amount) return "N/A";
    return `Rp ${parseFloat(this.original_amount).toLocaleString("id-ID")}`;
  };

  DeliveryOrderAdjustments.prototype.getFormattedAdjustmentAmount =
    function () {
      return `Rp ${parseFloat(this.adjustment_amount).toLocaleString("id-ID")}`;
    };

  DeliveryOrderAdjustments.prototype.getFormattedFinalAmount = function () {
    return `Rp ${parseFloat(this.final_amount).toLocaleString("id-ID")}`;
  };

  DeliveryOrderAdjustments.prototype.isReduction = function () {
    if (!this.original_amount) return false;
    return parseFloat(this.final_amount) < parseFloat(this.original_amount);
  };

  DeliveryOrderAdjustments.prototype.isIncrease = function () {
    if (!this.original_amount) return false;
    return parseFloat(this.final_amount) > parseFloat(this.original_amount);
  };

  return DeliveryOrderAdjustments;
};
