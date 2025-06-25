// src/models/deliveryOrderInvoices.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrderInvoices = sequelize.define(
    "DeliveryOrderInvoices",
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
      invoice_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: {
          msg: "Invoice number must be unique",
        },
        validate: {
          notEmpty: {
            msg: "Invoice number cannot be empty",
          },
        },
      },
      invoice_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      invoice_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0],
            msg: "Invoice amount cannot be negative",
          },
        },
        comment: "Gross invoice amount before PPH",
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: "Payment due date",
      },
      pph_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.5,
        validate: {
          min: 0,
          max: 100,
        },
        comment: "PPH tax percentage",
      },
      pph_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
        comment: "Calculated PPH tax amount",
      },
      net_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
        comment: "Net amount after PPH deduction",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "issued",
        validate: {
          isIn: {
            args: [["issued", "sent", "paid", "overdue", "cancelled"]],
            msg: "Status must be issued, sent, paid, overdue, or cancelled",
          },
        },
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      tableName: "delivery_order_invoices",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["invoice_number"],
        },
        {
          fields: ["delivery_order_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["due_date"],
        },
        {
          fields: ["invoice_date"],
        },
      ],
      hooks: {
        beforeCreate: (invoice) => {
          // Auto-calculate PPH and net amount
          const grossAmount = parseFloat(invoice.invoice_amount) || 0;
          const pphPercentage = parseFloat(invoice.pph_percentage) || 0;
          const pphAmount = (grossAmount * pphPercentage) / 100;

          invoice.pph_amount = pphAmount;
          invoice.net_amount = grossAmount - pphAmount;

          // Set due date if not provided (30 days default)
          if (!invoice.due_date) {
            const dueDate = new Date(invoice.invoice_date);
            dueDate.setDate(dueDate.getDate() + 30);
            invoice.due_date = dueDate;
          }
        },
        beforeUpdate: (invoice) => {
          invoice.updated_at = new Date();

          // Recalculate if amounts changed
          if (
            invoice.changed("invoice_amount") ||
            invoice.changed("pph_percentage")
          ) {
            const grossAmount = parseFloat(invoice.invoice_amount) || 0;
            const pphPercentage = parseFloat(invoice.pph_percentage) || 0;
            const pphAmount = (grossAmount * pphPercentage) / 100;

            invoice.pph_amount = pphAmount;
            invoice.net_amount = grossAmount - pphAmount;
          }
        },
      },
    }
  );

  // Instance methods
  DeliveryOrderInvoices.prototype.getFormattedGrossAmount = function () {
    return `Rp ${parseFloat(this.invoice_amount).toLocaleString("id-ID")}`;
  };

  DeliveryOrderInvoices.prototype.getFormattedNetAmount = function () {
    return `Rp ${parseFloat(this.net_amount).toLocaleString("id-ID")}`;
  };

  DeliveryOrderInvoices.prototype.getFormattedPPH = function () {
    return `Rp ${parseFloat(this.pph_amount).toLocaleString("id-ID")} (${
      this.pph_percentage
    }%)`;
  };

  DeliveryOrderInvoices.prototype.isOverdue = function () {
    if (!this.due_date || this.status === "paid") return false;
    return new Date() > new Date(this.due_date);
  };

  DeliveryOrderInvoices.prototype.getDaysUntilDue = function () {
    if (!this.due_date) return null;
    const today = new Date();
    const dueDate = new Date(this.due_date);
    const diffTime = dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  DeliveryOrderInvoices.prototype.getStatusText = function () {
    const statusMap = {
      issued: "Diterbitkan",
      sent: "Dikirim",
      paid: "Dibayar",
      overdue: "Jatuh Tempo",
      cancelled: "Dibatalkan",
    };
    return statusMap[this.status] || this.status;
  };

  return DeliveryOrderInvoices;
};
