// src/models/invoice.model.js
const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const Invoice = sequelize.define(
    "Invoice",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      po_id: { type: DataTypes.INTEGER, allowNull: false },
      invoice_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      invoice_date: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
      total_penagihan: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      pph_percentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0.5 },
      pph_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      grand_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      paid_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: "issued",
        validate: {
          isIn: [
            ["issued", "sent", "partial", "completed", "overdue", "cancelled"],
          ],
        },
      },
      notes: { type: DataTypes.TEXT },
      due_date: { type: DataTypes.DATE },
      created_by: { type: DataTypes.INTEGER },
      created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    },
    {
      tableName: "invoices",
      timestamps: false,
    }
  );

  // Instance method: Check if fully paid
  Invoice.prototype.isFullyPaid = function () {
    return this.paid_amount >= this.grand_total;
  };

  return Invoice;
};
