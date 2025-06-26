// src/models/tireInventory.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TireInventory = sequelize.define('TireInventory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tire_brand: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Tire brand cannot be empty'
        }
      }
    },
    tire_size: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Tire size cannot be empty'
        }
      }
    },
    tire_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    current_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Stock cannot be negative'
        }
      }
    },
    min_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Minimum stock cannot be negative'
        }
      }
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Price cannot be negative'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'tire_inventory',
    timestamps: false
  });

  return TireInventory;
};
