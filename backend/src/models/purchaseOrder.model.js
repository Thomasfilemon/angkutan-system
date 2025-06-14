const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    po_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    order_date: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'in_progress', 'completed', 'cancelled']] },
    },
    notes: { type: DataTypes.TEXT },
  }, {
    tableName: 'purchase_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // We don't have an updatedAt column in the migration
  });
  return PurchaseOrder;
};
