module.exports = (sequelize, DataTypes) => {
  const DriverExpense = sequelize.define('DriverExpense', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    trip_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'trips',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    driver_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    jenis: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    receipt_url: {
      type: DataTypes.TEXT
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'driver_expenses',
    timestamps: false
  });

  DriverExpense.associate = (models) => {
    DriverExpense.belongsTo(models.Trip, { foreignKey: 'trip_id', as: 'trip' });
    DriverExpense.belongsTo(models.User, { foreignKey: 'driver_id', as: 'driver' });
  };

  return DriverExpense;
};
