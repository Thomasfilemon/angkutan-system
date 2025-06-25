// src/models/deliveryOrderPaymentHistory.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrderPaymentHistory = sequelize.define(
    "DeliveryOrderPaymentHistory",
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
      old_status: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: "Previous payment status",
      },
      new_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: "New payment status",
      },
      change_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Reason for status change",
      },
      changed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      changed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "changed_at",
      },
    },
    {
      tableName: "delivery_order_payment_history",
      timestamps: false,
      indexes: [
        {
          fields: ["delivery_order_id"],
        },
        {
          fields: ["changed_at"],
        },
        {
          fields: ["new_status"],
        },
      ],
    }
  );

  // Instance methods
  DeliveryOrderPaymentHistory.prototype.getFormattedDate = function () {
    return new Date(this.changed_at).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  DeliveryOrderPaymentHistory.prototype.getStatusChangeText = function () {
    const oldText = this.old_status
      ? this.old_status.replace("_", " ").toUpperCase()
      : "N/A";
    const newText = this.new_status.replace("_", " ").toUpperCase();
    return `${oldText} → ${newText}`;
  };

  return DeliveryOrderPaymentHistory;
};
