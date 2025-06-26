// backend/src/models/cashTransaction.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CashTransaction = sequelize.define('CashTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    transaction_type: {
      type: DataTypes.ENUM('debit', 'kredit'),
      allowNull: false
    },
    category_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'cash_categories',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    reference_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    transaction_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'cash_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return CashTransaction;
};
