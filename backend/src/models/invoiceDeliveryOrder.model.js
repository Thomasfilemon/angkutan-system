// src/models/invoiceDeliveryOrder.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const InvoiceDeliveryOrder = sequelize.define(
    "InvoiceDeliveryOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_id: { type: DataTypes.INTEGER, allowNull: false },
      delivery_order_id: { type: DataTypes.INTEGER, allowNull: false },
      gross_income: { type: DataTypes.DECIMAL(15, 2) },
    },
    {
      tableName: "invoice_delivery_orders",
      timestamps: false,
      uniqueKeys: {
        unique_invoice_do: {
          fields: ["invoice_id", "delivery_order_id"],
        },
      },
    }
  );

  return InvoiceDeliveryOrder;
};
