// src/models/payment.model.js
const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_id: { type: DataTypes.INTEGER, allowNull: false },
      payment_reference: { type: DataTypes.STRING(100) },
      payment_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [["cash", "transfer", "check", "giro"]] },
      },
      payment_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      payment_date: { type: DataTypes.DATE, allowNull: false },
      received_by: { type: DataTypes.INTEGER },
      bank_account: { type: DataTypes.STRING(100) },
      notes: { type: DataTypes.TEXT },
      attachment_url: { type: DataTypes.TEXT },
      created_by: { type: DataTypes.INTEGER },
      created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    },
    {
      tableName: "payments",
      timestamps: false,
    }
  );

  return Payment;
};
