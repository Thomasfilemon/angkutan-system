const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DeliveryOrder = sequelize.define('DeliveryOrder', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    do_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    item_name: { type: DataTypes.STRING },
    quantity: { type: DataTypes.DECIMAL },
    unit_price: { type: DataTypes.DECIMAL },
    total_amount: { type: DataTypes.DECIMAL, allowNull: false },
    load_location: { type: DataTypes.TEXT },
    unload_location: { type: DataTypes.TEXT },
    payment_status: {
      type: DataTypes.STRING,
      defaultValue: 'proses_tagihan',
      validate: { isIn: [['lunas', 'deposit', 'proses_tagihan']] },
    },
    // ... add other payment fields as needed
    status: {
      type: DataTypes.ENUM('assigned', 'otw_to_destination', 'at_destination', 'otw_to_base', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'assigned',
    },
    started_at: { type: DataTypes.DATE },
    reached_destination_at: { type: DataTypes.DATE },
    started_return_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
  }, {
    tableName: 'delivery_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
  return DeliveryOrder;
};
