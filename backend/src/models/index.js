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
// NEW: Stock and Service Management Models
const setupStockCategoryModel = require("./stockCategory.model");
const setupStockItemModel = require("./stockItem.model");
const setupStockTransactionModel = require("./stockTransaction.model");
const setupServiceItemModel = require("./serviceItem.model");

const setupTireInventoryModel = require('./tireInventory.model');
const setupVehicleTireModel = require('./vehicleTire.model');
const setupTireInspectionModel = require('./tireInspection.model');
const setupTireInstanceModel = require("./tireInstance.model");


// Initialize Sequelize connection using your .env variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: console.log,
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
// NEW: Stock and Service Management Models
db.StockCategory = setupStockCategoryModel(sequelize);
db.StockItem = setupStockItemModel(sequelize);
db.StockTransaction = setupStockTransactionModel(sequelize);
db.ServiceItem = setupServiceItemModel(sequelize);

db.TireInventory = setupTireInventoryModel(sequelize);
db.VehicleTire = setupVehicleTireModel(sequelize);
db.TireInspection = setupTireInspectionModel(sequelize);
db.TireInstance = setupTireInstanceModel(sequelize);


// === Define All Model Associations ===
const {
  User,
  DriverProfile,
  AdminProfile,
  PurchaseOrder,
  DeliveryOrder,
  Vehicle,
  DriverExpense,
  VehicleService,
  StockCategory,
  StockItem,
  StockTransaction,
  ServiceItem,
  TireInventory,
  VehicleTire,
  TireInspection,
  TireInstance,
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

// Vehicle <-> Driver (User) Assignments
User.hasMany(Vehicle, { 
  foreignKey: "driver_id", 
  as: "assignedVehicles" 
});
Vehicle.belongsTo(User, { 
  foreignKey: "driver_id", 
  as: "driver" // Changed from "assignedDriver" to match your controller
});

// Vehicle <-> DriverProfile (through User)
Vehicle.belongsTo(DriverProfile, {
  foreignKey: "driver_id",
  targetKey: "user_id",
  as: "driverProfile"
});
DriverProfile.hasMany(Vehicle, {
  foreignKey: "driver_id",
  sourceKey: "user_id",
  as: "assignedVehicles"
});

// Expense-related Associations (One-to-Many)
DeliveryOrder.hasMany(DriverExpense, {
  foreignKey: "delivery_order_id",
  as: "expenses",
});
DriverExpense.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});

// Vehicle Service Associations
Vehicle.hasMany(VehicleService, {
  foreignKey: "vehicle_id",
  as: "serviceHistory",
});
VehicleService.belongsTo(Vehicle, { foreignKey: "vehicle_id", as: "vehicle" });

// User (as Driver) <-> DriverExpense
User.hasMany(DriverExpense, { foreignKey: "driver_id", as: "driverExpenses" });
DriverExpense.belongsTo(User, { foreignKey: "driver_id", as: "driver" });

// === NEW: Stock Management Associations ===

// StockCategory <-> StockItem (One-to-Many)
StockCategory.hasMany(StockItem, {
  foreignKey: "category_id",
  as: "items"
});
StockItem.belongsTo(StockCategory, {
  foreignKey: "category_id",
  as: "category"
});

// StockItem <-> StockTransaction (One-to-Many)
StockItem.hasMany(StockTransaction, {
  foreignKey: "item_id",
  as: "transactions"
});
StockTransaction.belongsTo(StockItem, {
  foreignKey: "item_id",
  as: "stockItem"
});

// === NEW: Service Management Associations ===

// VehicleService <-> ServiceItem (One-to-Many)
VehicleService.hasMany(ServiceItem, {
  foreignKey: "service_id",
  as: "serviceItems"
});
ServiceItem.belongsTo(VehicleService, {
  foreignKey: "service_id",
  as: "service"
});

// StockItem <-> ServiceItem (Many-to-One, optional)
StockItem.hasMany(ServiceItem, {
  foreignKey: "stock_item_id",
  as: "usedInServices"
});
ServiceItem.belongsTo(StockItem, {
  foreignKey: "stock_item_id",
  as: "stockItem"
});

Vehicle.hasMany(VehicleTire, {
  foreignKey: 'vehicle_id',
  as: 'tires'
});
VehicleTire.belongsTo(Vehicle, {
  foreignKey: 'vehicle_id',
  as: 'vehicle'
});

TireInventory.hasMany(VehicleTire, {
  foreignKey: 'tire_inventory_id',
  as: 'installedTires'
});
VehicleTire.belongsTo(TireInventory, {
  foreignKey: 'tire_inventory_id',
  as: 'tireInventory'
});

VehicleTire.hasMany(TireInspection, {
  foreignKey: 'vehicle_tire_id',
  as: 'inspections'
});
TireInspection.belongsTo(VehicleTire, {
  foreignKey: 'vehicle_tire_id',
  as: 'vehicleTire'
});

TireInventory.hasMany(TireInstance, {
  foreignKey: 'tire_inventory_id',
  as: 'instances'
});
TireInstance.belongsTo(TireInventory, {
  foreignKey: 'tire_inventory_id',
  as: 'tireInventory'
});

VehicleTire.belongsTo(TireInstance, {
  foreignKey: 'tire_instance_id',
  as: 'tireInstance'
});
TireInstance.hasMany(VehicleTire, {
  foreignKey: 'tire_instance_id',
  as: 'installations'
});

TireInspection.belongsTo(TireInstance, {
  foreignKey: 'tire_instance_id',
  as: 'tireInstance'
});
TireInstance.hasMany(TireInspection, {
  foreignKey: 'tire_instance_id',
  as: 'inspections'
});

module.exports = db;
