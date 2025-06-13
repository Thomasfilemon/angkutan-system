module.exports = (sequelize, DataTypes) => {
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driver_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    vehicle_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'vehicles',
        key: 'id'
      }
    },
    drop_lat: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false
    },
    drop_lng: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false
    },
    ritase: {
      type: DataTypes.DECIMAL
    },
    tarif_per_ritase: {
      type: DataTypes.DECIMAL
    },
    total_ritase: {
      type: DataTypes.DECIMAL
    },
    status: {
      type: DataTypes.ENUM('on_progress', 'otw', 'perjalanan_pulang', 'selesai'),
      allowNull: false,
      defaultValue: 'on_progress'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    started_at: {
      type: DataTypes.DATE
    },
    reached_at: {
      type: DataTypes.DATE
    },
    returning_at: {
      type: DataTypes.DATE
    },
    completed_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'trips',
    timestamps: false
  });

  Trip.associate = (models) => {
    Trip.belongsTo(models.User, { foreignKey: 'driver_id', as: 'driver' });
    Trip.belongsTo(models.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
    Trip.hasMany(models.DriverExpense, { foreignKey: 'trip_id', as: 'expenses' });
    Trip.hasMany(models.DeliveryOrder, { foreignKey: 'trip_id', as: 'deliveryOrders' });
    Trip.hasMany(models.AccountingRitase, { foreignKey: 'trip_id', as: 'accountingRitase' });
  };

  return Trip;
};
