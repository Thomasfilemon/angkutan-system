// src/models/stockItem.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const StockItem = sequelize.define(
    "StockItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        references: {
          model: "stock_categories",
          key: "id",
        },
      },
      item_code: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true,
      },
      item_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Item name cannot be empty",
          },
        },
      },
      supplier: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Pcs",
      },
      // ❌ REMOVED: current_stock field (now calculated from batches)
      min_stock: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      // ❌ REMOVED: unit_price field (now using average_unit_price)
      average_unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      total_value: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "stock_items",
      timestamps: false,
      hooks: {
        beforeUpdate: (stockItem) => {
          stockItem.updated_at = new Date();
        },
      },
    }
  );

  return StockItem;
};
