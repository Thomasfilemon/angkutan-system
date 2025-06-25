// src/models/vehicleTire.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleTire = sequelize.define('VehicleTire', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehicle_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vehicles',
        key: 'id'
      }
    },
    tire_inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tire_inventory',
        key: 'id'
      }
    },
    position: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['FL', 'FR', 'RL1', 'RR1', 'RL2', 'RR2', 'RL3', 'RR3', 'SPARE1', 'SPARE2', 'SPARE3', 'SPARE4']],
          msg: 'Invalid tire position'
        }
      }
    },
    install_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    mileage_installed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    current_pressure: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Pressure cannot be negative'
        },
        max: {
          args: [200],
          msg: 'Pressure cannot exceed 200 PSI'
        }
      }
    },
    recommended_pressure: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 35,
      validate: {
        min: {
          args: [10],
          msg: 'Recommended pressure must be at least 10 PSI'
        },
        max: {
          args: [150],
          msg: 'Recommended pressure cannot exceed 150 PSI'
        }
      }
    },
    tread_depth: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 10.0,
      validate: {
        min: {
          args: [0],
          msg: 'Tread depth cannot be negative'
        },
        max: {
          args: [20],
          msg: 'Tread depth cannot exceed 20mm'
        }
      }
    },
    temperature: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: false,
      defaultValue: 25.0,
      validate: {
        min: {
          args: [-50],
          msg: 'Temperature cannot be below -50°C'
        },
        max: {
          args: [200],
          msg: 'Temperature cannot exceed 200°C'
        }
      }
    },
    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'good',
      validate: {
        isIn: {
          args: [['good', 'fair', 'poor', 'replace']],
          msg: 'Condition must be one of: good, fair, poor, replace'
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'removed', 'damaged']],
          msg: 'Status must be one of: active, removed, damaged'
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
    tableName: 'vehicle_tires',
    timestamps: false,
    hooks: {
      beforeUpdate: (tire) => {
        tire.updated_at = new Date();
      }
    }
  });

  // Instance methods
  VehicleTire.prototype.isPressureLow = function() {
    return this.current_pressure < (this.recommended_pressure * 0.8);
  };

  VehicleTire.prototype.isPressureHigh = function() {
    return this.current_pressure > (this.recommended_pressure * 1.2);
  };

  VehicleTire.prototype.isTemperatureHigh = function() {
    return this.temperature > 60;
  };

  VehicleTire.prototype.needsReplacement = function() {
    return this.condition === 'replace' || this.tread_depth < 1.6;
  };

  return VehicleTire;
};
