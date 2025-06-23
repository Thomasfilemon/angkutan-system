// src/models/serviceItem.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceItem = sequelize.define('ServiceItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vehicle_services',
        key: 'id'
      }
    },
    stock_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'stock_items',
        key: 'id'
      }
    },
    item_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    from_stock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'service_items',
    timestamps: false
  });

  return ServiceItem;
};
