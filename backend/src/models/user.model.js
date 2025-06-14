
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        msg: 'Username already exists'
      },
      validate: {
        notEmpty: {
          msg: 'Username cannot be empty'
        },
        len: {
          args: [3, 50],
          msg: 'Username must be between 3 and 50 characters'
        }
      }
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Password hash cannot be empty'
        }
      }
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['owner', 'admin', 'driver']],
          msg: 'Role must be one of: owner, admin, driver'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'users',
    timestamps: false, // We're managing created_at manually
    indexes: [
      {
        unique: true,
        fields: ['username']
      },
      {
        fields: ['role']
      }
    ],
    hooks: {
      beforeValidate: (user) => {
        if (user.username) {
          user.username = user.username.toLowerCase().trim();
        }
      }
    }
  });

  // Instance methods
  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password_hash; // Never return password hash
    return values;
  };

  // Class methods
  User.findByUsername = function(username) {
    return this.findOne({
      where: { username: username.toLowerCase() }
    });
  };

  User.findDriversWithStatus = function(status = 'available') {
    return this.findAll({
      where: { role: 'driver' },
      include: [{
        association: 'profile',
        where: { status },
        required: true
      }]
    });
  };

  return User;
};