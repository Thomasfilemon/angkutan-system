// src/models/VehicleService.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleService = sequelize.define('VehicleService', {
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
    service_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    service_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: {
          msg: 'Service date must be a valid date'
        }
      }
    },
    service_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'regular',
      validate: {
        isIn: {
          args: [['regular', 'with_parts']],
          msg: 'Service type must be either regular or with_parts'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Description cannot be empty'
        }
      }
    },
    workshop_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    labor_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    parts_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'completed',
      validate: {
        isIn: {
          args: [['completed', 'cancelled']],
          msg: 'Status must be either completed or cancelled'
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
    tableName: 'vehicle_services',
    timestamps: false,
    hooks: {
      beforeCreate: async (service) => {
        if (!service.service_number) {
          const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const count = await VehicleService.count({
            where: {
              service_date: service.service_date
            }
          });
          service.service_number = `SRV-${date}-${String(count + 1).padStart(3, '0')}`;
        }
      },
      beforeUpdate: (service) => {
        service.updated_at = new Date();
      }
    }
  });

  return VehicleService;
};
