// src/models/adminProfile.model.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminProfile = sequelize.define('AdminProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users', // This must match the table name for your User model
        key: 'id'
      },
      onDelete: 'CASCADE' // If a user is deleted, their profile is also deleted
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Full name cannot be empty' }
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Phone number cannot be empty' }
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'Email cannot be empty' },
        isEmail: { msg: 'Must be a valid email address' }
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true // Or false, depending on your requirements
    }
  }, {
    tableName: 'admin_profiles',
    timestamps: false // We are not using createdAt/updatedAt columns in this table
  });

  return AdminProfile;
};
