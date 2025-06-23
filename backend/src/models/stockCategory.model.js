// src/models/stockCategory.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StockCategory = sequelize.define('StockCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Category name cannot be empty'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'stock_categories',
    timestamps: false
  });

  return StockCategory;
};
