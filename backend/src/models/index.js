"use strict";

const { Sequelize } = require("sequelize");

// Load all model setup functions
const setupUserModel = require("./user.model");
const setupVehicleModel = require("./vehicle.model");
const setupDriverProfileModel = require("./driverProfile.model");
const setupAdminProfileModel = require("./adminProfile.model");
const setupPurchaseOrderModel = require("./purchaseOrder.model");
const setupDeliveryOrderModel = require("./deliveryOrder.model");
const setupDriverExpenseModel = require("./driverExpense.model");
const setupVehicleServiceModel = require("./vehicleService.model");

// Initialize Sequelize connection using your .env variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: console.log, // Set to console.log to see the generated SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Load models into the db object
db.User = setupUserModel(sequelize);
db.Vehicle = setupVehicleModel(sequelize);
db.DriverProfile = setupDriverProfileModel(sequelize);
db.AdminProfile = setupAdminProfileModel(sequelize);
db.PurchaseOrder = setupPurchaseOrderModel(sequelize);
db.DeliveryOrder = setupDeliveryOrderModel(sequelize);
db.DriverExpense = setupDriverExpenseModel(sequelize);
db.VehicleService = setupVehicleServiceModel(sequelize);

// === Define All Model Associations ===
// This is where you tell Sequelize how your tables are related.
// The 'as' alias is critical and must match what you use in your controllers' 'include' statements.

const {
  User,
  DriverProfile,
  AdminProfile,
  PurchaseOrder,
  DeliveryOrder,
  Vehicle,
  DriverExpense,
  VehicleService,
} = db;

// User <-> Profile Associations (One-to-One)
User.hasOne(DriverProfile, { foreignKey: "user_id", as: "driverProfile" });
DriverProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(AdminProfile, { foreignKey: "user_id", as: "adminProfile" });
AdminProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Order-related Associations (One-to-Many)
PurchaseOrder.hasMany(DeliveryOrder, {
  foreignKey: "purchase_order_id",
  as: "deliveryOrders",
});
DeliveryOrder.belongsTo(PurchaseOrder, {
  foreignKey: "purchase_order_id",
  as: "purchaseOrder",
});

// User (as Driver) <-> DeliveryOrder
User.hasMany(DeliveryOrder, { foreignKey: "driver_id", as: "deliveryOrders" });
DeliveryOrder.belongsTo(User, { foreignKey: "driver_id", as: "driver" });

// Vehicle <-> DeliveryOrder
Vehicle.hasMany(DeliveryOrder, {
  foreignKey: "vehicle_id",
  as: "deliveryOrders",
});
DeliveryOrder.belongsTo(Vehicle, { foreignKey: "vehicle_id", as: "vehicle" });

// Expense-related Associations (One-to-Many)
DeliveryOrder.hasMany(DriverExpense, {
  foreignKey: "delivery_order_id",
  as: "expenses",
});
DriverExpense.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "DeliveryOrder",
});

Vehicle.hasMany(VehicleService, {
  foreignKey: "vehicle_id",
  as: "serviceHistory",
});
VehicleService.belongsTo(Vehicle, { foreignKey: "vehicle_id", as: "vehicle" });

// User (as Driver) <-> DriverExpense
User.hasMany(DriverExpense, { foreignKey: "driver_id", as: "driverExpenses" });
DriverExpense.belongsTo(User, { foreignKey: "driver_id", as: "driver" });

module.exports = db;
