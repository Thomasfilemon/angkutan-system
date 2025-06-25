// src/models/tireInspection.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TireInspection = sequelize.define('TireInspection', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehicle_tire_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vehicle_tires',
        key: 'id'
      }
    },
    inspection_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    tread_depth: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Tread depth cannot be negative'
        }
      }
    },
    air_pressure: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Air pressure cannot be negative'
        }
      }
    },
    temperature: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true
    },
    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['good', 'fair', 'poor', 'replace']],
          msg: 'Condition must be one of: good, fair, poor, replace'
        }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    inspector_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'tire_inspections',
    timestamps: false
  });

  return TireInspection;
};
