module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    license_plate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'vehicles',
    timestamps: false
  });

  Vehicle.associate = (models) => {
    if (models.Trip) {
      Vehicle.hasMany(models.Trip, { foreignKey: 'vehicle_id', as: 'trips' });
    }
  };

  return Vehicle;
};
