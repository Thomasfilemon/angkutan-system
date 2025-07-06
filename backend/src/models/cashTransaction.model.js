const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CashTransaction = sequelize.define('CashTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    transaction_type: {
      type: DataTypes.ENUM('debit', 'kredit', 'debit_tempo', 'kredit_tempo'), // Added new types
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
    account: {
      type: DataTypes.ENUM('Ewaldo', 'Malvin', 'Company', 'General'),
      allowNull: false
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