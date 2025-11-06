const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TempoDetail = sequelize.define('TempoDetail', {
    cash_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    store_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'lunas'),
      allowNull: false,
      defaultValue: 'pending'
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    nota_attachment_url: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    }
  }, {
    tableName: 'tempo_details',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TempoDetail;
};