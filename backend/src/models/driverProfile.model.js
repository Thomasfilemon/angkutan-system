
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverProfile = sequelize.define('DriverProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: {
        msg: 'Driver profile already exists for this user'
      },
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Full name cannot be empty'
        },
        len: {
          args: [2, 100],
          msg: 'Full name must be between 2 and 100 characters'
        }
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Phone number cannot be empty'
        },
        isPhoneNumber(value) {
          const phoneRegex = /^(\+62|62|0)[0-9]{8,13}$/;
          if (!phoneRegex.test(value.replace(/\s|-/g, ''))) {
            throw new Error('Invalid Indonesian phone number format');
          }
        }
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Address cannot be empty'
        },
        len: {
          args: [10, 500],
          msg: 'Address must be between 10 and 500 characters'
        }
      }
    },
    id_card_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        msg: 'ID card number already exists'
      },
      validate: {
        notEmpty: {
          msg: 'ID card number cannot be empty'
        },
        isIdCard(value) {
          const idCardRegex = /^[0-9]{16}$/;
          if (!idCardRegex.test(value)) {
            throw new Error('ID card number must be 16 digits');
          }
        }
      }
    },
    sim_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: {
        msg: 'SIM number already exists'
      },
      validate: {
        len: {
          args: [0, 50],
          msg: 'SIM number must not exceed 50 characters'
        }
      }
    },
    license_type: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        isIn: {
          args: [['A', 'B1', 'B2', 'C', 'D']],
          msg: 'License type must be one of: A, B1, B2, C, D'
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'available',
      validate: {
        isIn: {
          args: [['available', 'busy']],
          msg: 'Status must be either available or busy'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'driver_profiles',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      },
      {
        unique: true,
        fields: ['id_card_number']
      },
      {
        unique: true,
        fields: ['sim_number']
      },
      {
        fields: ['status']
      },
      {
        fields: ['full_name']
      }
    ],
    hooks: {
      beforeValidate: (profile) => {
        if (profile.full_name) {
          profile.full_name = profile.full_name.trim();
        }
        if (profile.phone) {
          profile.phone = profile.phone.replace(/\s|-/g, '');
        }
        if (profile.id_card_number) {
          profile.id_card_number = profile.id_card_number.replace(/\s|-/g, '');
        }
        if (profile.sim_number) {
          profile.sim_number = profile.sim_number.trim();
        }
        if (profile.license_type) {
          profile.license_type = profile.license_type.toUpperCase();
        }
      }
    }
  });

  // Instance methods
  DriverProfile.prototype.isAvailable = function() {
    return this.status === 'available';
  };

  DriverProfile.prototype.setBusy = function() {
    return this.update({ status: 'busy' });
  };

  DriverProfile.prototype.setAvailable = function() {
    return this.update({ status: 'available' });
  };

  DriverProfile.prototype.getFormattedPhone = function() {
    const phone = this.phone;
    if (phone.startsWith('62')) {
      return '+' + phone;
    } else if (phone.startsWith('0')) {
      return '+62' + phone.substring(1);
    }
    return phone;
  };

  // Class methods
  DriverProfile.findAvailable = function() {
    return this.findAll({
      where: { status: 'available' },
      include: [{
        association: 'User',
        attributes: ['id', 'username', 'role']
      }],
      order: [['full_name', 'ASC']]
    });
  };

  DriverProfile.findByIdCard = function(idCardNumber) {
    return this.findOne({
      where: { id_card_number: idCardNumber.replace(/\s|-/g, '') }
    });
  };

  DriverProfile.findBySIM = function(simNumber) {
    return this.findOne({
      where: { sim_number: simNumber.trim() }
    });
  };

  return DriverProfile;
};