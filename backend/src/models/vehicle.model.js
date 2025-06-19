const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    license_plate: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: {
        msg: 'License plate already exists'
      },
      validate: {
        notEmpty: {
          msg: 'License plate cannot be empty'
        },
        len: {
          args: [5, 20],
          msg: 'License plate must be between 5 and 20 characters'
        }
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: {
          args: [0, 50],
          msg: 'Vehicle type must not exceed 50 characters'
        }
      }
    },
     capacity: {
      type: DataTypes.STRING(10), // Changed from INTEGER to STRING
      allowNull: true,
      validate: {
        isNumericString(value) {
          if (value !== null && value !== undefined && value !== '') {
            // Check if the string contains only digits
            if (!/^\d+$/.test(value.toString().trim())) {
              throw new Error('Capacity must contain only numbers');
            }
            
            // Optional: Check if the number is reasonable (not too large)
            const numValue = parseInt(value, 10);
            if (numValue < 0) {
              throw new Error('Capacity must be a positive number');
            }
            if (numValue > 999999) {
              throw new Error('Capacity cannot exceed 999,999 kg');
            }
          }
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'available',
      validate: {
        isIn: {
          args: [['available', 'in_use', 'maintenance']],
          msg: 'Status must be one of: available, in_use, maintenance'
        }
      }
    },
    last_service_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Last service date must be a valid date'
        }
      }
    },
    next_service_due: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Next service due must be a valid date'
        },
        isAfterLastService(value) {
          if (value && this.last_service_date && value <= this.last_service_date) {
            throw new Error('Next service due must be after last service date');
          }
        }
      }
    },
    stnk_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: {
        msg: 'STNK number already exists'
      },
      validate: {
        len: {
          args: [0, 50],
          msg: 'STNK number must not exceed 50 characters'
        }
      }
    },
    stnk_expired_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'STNK expired date must be a valid date'
        }
      }
    },
    tax_due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Tax due date must be a valid date'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'vehicles',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['license_plate']
      },
      {
        unique: true,
        fields: ['stnk_number']
      },
      {
        fields: ['status']
      },
      {
        fields: ['tax_due_date']
      },
      {
        fields: ['stnk_expired_date']
      }
    ],
    hooks: {
      beforeValidate: (vehicle) => {
        console.log('=== BEFORE VALIDATE HOOK ===');
        console.log('Original vehicle.capacity:', vehicle.capacity, 'type:', typeof vehicle.capacity);
        
        // Handle license plate and STNK formatting
        if (vehicle.license_plate) {
          vehicle.license_plate = vehicle.license_plate.toUpperCase().trim();
        }
        if (vehicle.stnk_number) {
          vehicle.stnk_number = vehicle.stnk_number.trim();
        }
        
        // Handle capacity conversion
        if (vehicle.capacity !== null && vehicle.capacity !== undefined && vehicle.capacity !== '') {
          if (typeof vehicle.capacity === 'string') {
            const trimmed = vehicle.capacity.trim();
            console.log('Trimmed capacity string:', trimmed);
            
            if (trimmed === '') {
              vehicle.capacity = null;
            } else {
              const parsed = parseInt(trimmed, 10);
              console.log('Parsed capacity:', parsed);
              vehicle.capacity = isNaN(parsed) ? null : parsed;
            }
          }
        }
        
        console.log('Final vehicle.capacity:', vehicle.capacity, 'type:', typeof vehicle.capacity);
        console.log('===========================');
      }
    }
  });

  // Instance methods
  Vehicle.prototype.isAvailable = function() {
    return this.status === 'available';
  };

  Vehicle.prototype.isMaintenanceDue = function() {
    if (!this.next_service_due) return false;
    return new Date(this.next_service_due) <= new Date();
  };

  Vehicle.prototype.isTaxDue = function() {
    if (!this.tax_due_date) return false;
    return new Date(this.tax_due_date) <= new Date();
  };

  Vehicle.prototype.isSTNKExpired = function() {
    if (!this.stnk_expired_date) return false;
    return new Date(this.stnk_expired_date) <= new Date();
  };

  // Class methods
  Vehicle.findAvailable = function() {
    return this.findAll({
      where: { status: 'available' },
      order: [['license_plate', 'ASC']]
    });
  };

  Vehicle.findMaintenanceDue = function() {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        next_service_due: {
          [Op.lte]: new Date()
        }
      }
    });
  };

  Vehicle.findDocumentExpiring = function(days = 30) {
    const { Op } = require('sequelize');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.findAll({
      where: {
        [Op.or]: [
          {
            stnk_expired_date: {
              [Op.lte]: futureDate
            }
          },
          {
            tax_due_date: {
              [Op.lte]: futureDate
            }
          }
        ]
      }
    });
  };

  return Vehicle;
};