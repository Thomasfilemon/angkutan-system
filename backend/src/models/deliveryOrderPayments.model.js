// src/models/deliveryOrderPayments.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrderPayments = sequelize.define(
    "DeliveryOrderPayments",
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
        comment: "Reference to delivery order",
      },
      invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "delivery_order_invoices",
          key: "id",
        },
        comment: "Optional reference to specific invoice",
      },
      payment_reference: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "Bank reference, check number, transfer ID, etc.",
      },
      payment_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: {
            args: [["cash", "transfer", "check", "giro"]],
            msg: "Payment type must be cash, transfer, check, or giro",
          },
        },
        comment: "Method of payment",
      },
      payment_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0.01],
            msg: "Payment amount must be greater than 0",
          },
        },
        comment: "Amount received",
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: "Date payment was received",
      },
      received_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        comment: "User who processed the payment",
      },
      bank_account: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "Bank account used for transfer payments",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Additional payment notes",
      },
      attachment_urls: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
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
      tableName: "delivery_order_payments",
      timestamps: false,
      indexes: [
        {
          fields: ["delivery_order_id"],
        },
        {
          fields: ["payment_date"],
        },
        {
          fields: ["payment_type"],
        },
        {
          fields: ["invoice_id"],
        },
      ],
      hooks: {
        afterCreate: async (payment, options) => {
          // Could trigger payment status update here if needed
          console.log(
            `Payment recorded: ${payment.payment_amount} for DO ${payment.delivery_order_id}`
          );
        },
      },
    }
  );

  // Instance methods
  DeliveryOrderPayments.prototype.getFormattedAmount = function () {
    return `Rp ${parseFloat(this.payment_amount).toLocaleString("id-ID")}`;
  };

  DeliveryOrderPayments.prototype.getPaymentTypeText = function () {
    const typeMap = {
      cash: "Tunai",
      transfer: "Transfer Bank",
      check: "Cek",
      giro: "Giro",
    };
    return typeMap[this.payment_type] || this.payment_type;
  };

  return DeliveryOrderPayments;
};
