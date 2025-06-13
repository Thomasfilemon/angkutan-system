module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    license_plate: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50)
    },
    capacity: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('available', 'in_use', 'maintenance'),
      allowNull: false,
      defaultValue: 'available'
    },
    last_service_date: {
      type: DataTypes.DATEONLY
    },
    next_service_due: {
      type: DataTypes.DATEONLY
    },
    stnk_number: {
      type: DataTypes.STRING(50),
      unique: true
    },
    stnk_expired_date: {
      type: DataTypes.DATEONLY
    },
    tax_due_date: {
      type: DataTypes.DATEONLY
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'vehicles',
    timestamps: false
  });

  Vehicle.associate = (models) => {
    Vehicle.hasMany(models.Trip, { foreignKey: 'vehicle_id', as: 'trips' });
    Vehicle.hasMany(models.VehicleService, { foreignKey: 'vehicle_id', as: 'services' });
    Vehicle.hasMany(models.VehicleTire, { foreignKey: 'vehicle_id', as: 'tires' });
  };

  return Vehicle;
};
