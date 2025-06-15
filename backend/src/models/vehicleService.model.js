// src/models/vehicleService.model.js

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
      },
      onDelete: 'CASCADE'
    },
    service_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    workshop_name: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'vehicle_services',
    timestamps: false // No created_at/updated_at needed
  });

  return VehicleService;
};
