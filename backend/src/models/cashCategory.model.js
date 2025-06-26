// backend/src/models/cashCategory.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CashCategory = sequelize.define('CashCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    category_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    category_type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'cash_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return CashCategory;
};
