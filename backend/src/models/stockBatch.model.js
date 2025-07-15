// src/models/stockBatch.model.js
const { DataTypes } = require("sequelize");

const setupStockBatchModel = (sequelize) => {
  const StockBatch = sequelize.define(
    "StockBatch",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "stock_items",
          key: "id",
        },
      },
      batch_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      original_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      purchase_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      supplier: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      tableName: "stock_batches",
      timestamps: false,
      hooks: {
        beforeUpdate: (batch) => {
          batch.updated_at = new Date();
        },
      },
    }
  );

  return StockBatch;
};

module.exports = setupStockBatchModel;
