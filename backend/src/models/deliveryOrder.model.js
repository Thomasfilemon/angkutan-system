// In src/models/deliveryOrder.model.js
const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const DeliveryOrder = sequelize.define(
    "DeliveryOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // --- FOREIGN KEY FIXES ---
      // Make sure these field names match your database columns EXACTLY
      purchase_order_id: { type: DataTypes.INTEGER },
      driver_id: { type: DataTypes.INTEGER },
      vehicle_id: { type: DataTypes.INTEGER },

      // --- OTHER FIELDS ---
      do_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      item_name: { type: DataTypes.STRING(100) },
      quantity: { type: DataTypes.DECIMAL },
      unit_price: { type: DataTypes.DECIMAL },
      total_amount: { type: DataTypes.DECIMAL, allowNull: false },
      load_location: { type: DataTypes.TEXT },
      unload_location: { type: DataTypes.TEXT },
      surat_jalan_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payment_status: {
        type: DataTypes.STRING(20),
        defaultValue: "proses_tagihan",
        validate: { isIn: [["lunas", "deposit", "proses_tagihan"]] },
      },
      payment_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["cash", "transfer", "deposit"]] },
      },
      deposit_amount: { type: DataTypes.DECIMAL, defaultValue: 0 },
      invoice_amount: { type: DataTypes.DECIMAL },
      due_date: { type: DataTypes.DATE },
      status: {
        // The ENUM type in Sequelize must match the custom type 'delivery_status' in Postgres
        type: DataTypes.ENUM(
          "assigned",
          "otw_to_destination",
          "at_destination",
          "otw_to_base",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "assigned",
      },

      // --- TIMESTAMP FIXES ---
      // Use Sequelize's built-in timestamp options instead of manual fields
      // created_at, started_at, reached_destination_at, etc., should be handled by Sequelize's options
      started_at: { type: DataTypes.DATE },
      reached_destination_at: { type: DataTypes.DATE },
      started_return_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
      created_at: {
        type: DataTypes.DATE,
        field: "created_at", // Map this field to the created_at column
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "delivery_orders",
      timestamps: false, // We set timestamps: false because your DB handles created_at with a DEFAULT.
      // If you want Sequelize to manage it, set timestamps: true and remove the defaultValue in the model.
    }
  );
  return DeliveryOrder;
};
