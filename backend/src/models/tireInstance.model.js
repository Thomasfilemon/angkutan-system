// src/models/tireInstance.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TireInstance = sequelize.define('TireInstance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tire_inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tire_inventory',
        key: 'id'
      }
    },
    tire_serial_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    purchase_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    total_mileage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    current_tread_depth: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 10.0
    },
    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'new',
      validate: {
        isIn: {
          args: [['new', 'good', 'fair', 'poor', 'damaged', 'disposed']],
          msg: 'Invalid condition'
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'in_stock',
      validate: {
        isIn: {
          args: [['in_stock', 'installed', 'removed', 'disposed']],
          msg: 'Invalid status'
        }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'tire_instances',
    timestamps: false,
    hooks: {
      beforeUpdate: (instance) => {
        instance.updated_at = new Date();
      }
    }
  });

  return TireInstance;
};
