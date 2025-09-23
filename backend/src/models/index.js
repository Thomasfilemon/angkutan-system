"use strict";

const { Sequelize } = require("sequelize");

// Load all model setup functions
const setupUserModel = require("./user.model");
const setupVehicleModel = require("./vehicle.model");
const setupDriverProfileModel = require("./driverProfile.model");
const setupAdminProfileModel = require("./adminProfile.model");
const setupPurchaseOrderModel = require("./purchaseOrder.model");
const setupDeliveryOrderModel = require("./deliveryOrder.model");
const setupBigDeliveryOrderModel = require("./bigDeliveryOrder.model");
const setupBigDoTambahanModel = require("./bigDoTambahan.model");
const setupDriverExpenseModel = require("./driverExpense.model");
const setupVehicleServiceModel = require("./vehicleService.model");
// NEW: Stock and Service Management Models
const setupStockCategoryModel = require("./stockCategory.model");
const setupStockItemModel = require("./stockItem.model");
const setupStockTransactionModel = require("./stockTransaction.model");
const setupStockBatchModel = require("./stockBatch.model");
const setupServiceItemModel = require("./serviceItem.model");
// Usage note models (missing before)
const setupStockUsageNoteModel = require("./stockUsageNote.model");
const setupStockUsageNoteItemModel = require("./stockUsageNoteItem.model");

// Create model files for new Ritase tables
const setupDeliveryOrderPaymentsModel = require("./deliveryOrderPayments.model");
const setupDeliveryOrderInvoicesModel = require("./deliveryOrderInvoices.model");
const setupDeliveryOrderAdjustmentsModel = require("./deliveryOrderAdjustments.model");
const setupDeliveryOrderPaymentHistoryModel = require("./deliveryOrderPaymentHistory.model");
const setupSystemSettingsModel = require("./systemSettings.model");

const setupTireInventoryModel = require("./tireInventory.model");
const setupVehicleTireModel = require("./vehicleTire.model");
const setupTireInspectionModel = require("./tireInspection.model");
const setupTireInstanceModel = require("./tireInstance.model");

const setupCashCategoryModel = require("./cashCategory.model");
const setupCashTransactionModel = require("./cashTransaction.model");

const setupDepositGroupModel = require("./depositGroup.model");
const setupDepositGroupMemberModel = require("./depositGroupMember.model");
const setupDepositGroupInvoiceModel = require("./depositGroupInvoice.model");
const setupDepositGroupPaymentModel = require("./depositGroupPayment.model");
const setupDepositGroupTopupModel = require("./depositGroupTopup.model");
const setupTempoDetailModel = require("./tempoDetails.model");

// NEW: recap note models
const setupRecapNoteModel = require("./recapNote.model");
const setupRecapNoteItemModel = require("./recapNoteItem.model");

// Initialize Sequelize connection
// Prefer a single DATABASE_URL (Neon/Supabase), fallback to discrete vars
let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: "postgres",
      logging: console.log,
      dialectOptions: (process.env.DB_SSL === "true" || process.env.NODE_ENV === "production")
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

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
db.BigDeliveryOrder = setupBigDeliveryOrderModel(sequelize);
db.BigDoTambahan = setupBigDoTambahanModel(sequelize);
db.DriverExpense = setupDriverExpenseModel(sequelize);
db.VehicleService = setupVehicleServiceModel(sequelize);

db.StockCategory = setupStockCategoryModel(sequelize);
db.StockItem = setupStockItemModel(sequelize);
db.StockBatch = setupStockBatchModel(sequelize);
db.StockTransaction = setupStockTransactionModel(sequelize);
db.StockBatch = setupStockBatchModel(sequelize);
db.ServiceItem = setupServiceItemModel(sequelize);
db.StockUsageNote = setupStockUsageNoteModel(sequelize);
db.StockUsageNoteItem = setupStockUsageNoteItemModel(sequelize);

db.DeliveryOrderPayments = setupDeliveryOrderPaymentsModel(sequelize);
db.DeliveryOrderInvoices = setupDeliveryOrderInvoicesModel(sequelize);
db.DeliveryOrderAdjustments = setupDeliveryOrderAdjustmentsModel(sequelize);
db.DeliveryOrderPaymentHistory =
  setupDeliveryOrderPaymentHistoryModel(sequelize);
db.SystemSettings = setupSystemSettingsModel(sequelize);

db.TireInventory = setupTireInventoryModel(sequelize);
db.VehicleTire = setupVehicleTireModel(sequelize);
db.TireInspection = setupTireInspectionModel(sequelize);
db.TireInstance = setupTireInstanceModel(sequelize);

db.CashCategory = setupCashCategoryModel(sequelize);
db.CashTransaction = setupCashTransactionModel(sequelize);

db.DepositGroup = setupDepositGroupModel(sequelize);
db.DepositGroupMember = setupDepositGroupMemberModel(sequelize);
db.DepositGroupInvoice = setupDepositGroupInvoiceModel(sequelize);
db.DepositGroupPayment = setupDepositGroupPaymentModel(sequelize);
db.DepositGroupTopup = setupDepositGroupTopupModel(sequelize);
db.TempoDetail = setupTempoDetailModel(sequelize);

db.RecapNote = setupRecapNoteModel(sequelize);
db.RecapNoteItem = setupRecapNoteItemModel(sequelize);

// Minimal associations for recap notes
if (db.RecapNote && db.RecapNoteItem) {
  db.RecapNote.hasMany(db.RecapNoteItem, { as: "items", foreignKey: "recap_id", onDelete: "CASCADE" });
  db.RecapNoteItem.belongsTo(db.RecapNote, { as: "recap", foreignKey: "recap_id" });
}
if (db.RecapNote && db.Vehicle) {
  db.RecapNote.belongsTo(db.Vehicle, { as: "vehicle", foreignKey: "vehicle_id" });
}

const {
  User,
  DriverProfile,
  AdminProfile,
  PurchaseOrder,
  DeliveryOrder,
  BigDeliveryOrder,
  BigDoTambahan,
  Vehicle,
  DriverExpense,
  VehicleService,
  StockCategory,
  StockItem,
  StockTransaction,
  StockBatch,
  ServiceItem,
  TireInventory,
  VehicleTire,
  TireInspection,
  TireInstance,
  CashCategory,
  CashTransaction,
  DeliveryOrderPayments,
  DeliveryOrderInvoices,
  DeliveryOrderAdjustments,
  DeliveryOrderPaymentHistory,
  SystemSettings,
  DepositGroup,
  DepositGroupMember,
  DepositGroupInvoice,
  DepositGroupPayment,
  DepositGroupTopup,
  TempoDetail
} = db;

// User <-> Profile Associations (One-to-One)
User.hasOne(DriverProfile, { foreignKey: "user_id", as: "driverProfile" });
DriverProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(AdminProfile, { foreignKey: "user_id", as: "adminProfile" });
AdminProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Order-related Associations (One-to-Many)
PurchaseOrder.hasMany(DeliveryOrder, {
  as: "poDeliveryOrders",
  foreignKey: "purchase_order_id",
});
DeliveryOrder.belongsTo(PurchaseOrder, {
  as: "purchaseOrder",
  foreignKey: "purchase_order_id",
});

// User (as Driver) <-> DeliveryOrder
User.hasMany(DeliveryOrder, {
  foreignKey: "driver_id",
  as: "driverDeliveryOrders",
});
DeliveryOrder.belongsTo(User, { foreignKey: "driver_id", as: "driver" });

// Vehicle <-> DeliveryOrder
Vehicle.hasMany(DeliveryOrder, {
  foreignKey: "vehicle_id",
  as: "vehicleDeliveryOrders",
});
DeliveryOrder.belongsTo(Vehicle, { foreignKey: "vehicle_id", as: "vehicle" });

DeliveryOrder.belongsTo(User, {
  foreignKey: "payment_confirmed_by",
  as: "paymentConfirmedByUser",
});

// Vehicle <-> Driver (User) Assignments
User.hasMany(Vehicle, {
  foreignKey: "driver_id",
  as: "assignedVehicles",
});
Vehicle.belongsTo(User, {
  foreignKey: "driver_id",
  as: "driver",
});

// Vehicle <-> DriverProfile (through User)
Vehicle.belongsTo(DriverProfile, {
  foreignKey: "driver_id",
  targetKey: "user_id",
  as: "driverProfile",
});
DriverProfile.hasMany(Vehicle, {
  foreignKey: "driver_id",
  sourceKey: "user_id",
  as: "assignedVehicles",
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

// === Stock Management Associations ===
StockCategory.hasMany(StockItem, {
  foreignKey: "category_id",
  as: "items",
});
StockItem.belongsTo(StockCategory, {
  foreignKey: "category_id",
  as: "category",
});

StockItem.hasMany(StockTransaction, {
  foreignKey: "item_id",
  as: "transactions",
});
StockItem.hasMany(StockBatch, {
  foreignKey: "item_id",
  as: "batches",
});

StockBatch.belongsTo(StockItem, {
  foreignKey: "item_id",
  as: "stockItem",
});

StockTransaction.belongsTo(StockBatch, {
  foreignKey: "batch_id",
  as: "batch",
});

StockBatch.hasMany(StockTransaction, {
  foreignKey: "batch_id",
  as: "transactions",
});
StockTransaction.belongsTo(StockItem, {
  foreignKey: "item_id",
  as: "stockItem",
});

// === Service Management Associations ===
VehicleService.hasMany(ServiceItem, {
  foreignKey: "service_id",
  as: "serviceItems",
});
ServiceItem.belongsTo(VehicleService, {
  foreignKey: "service_id",
  as: "service",
});

StockItem.hasMany(ServiceItem, {
  foreignKey: "stock_item_id",
  as: "usedInServices",
});
ServiceItem.belongsTo(StockItem, {
  foreignKey: "stock_item_id",
  as: "stockItem",
});

// === Stock Usage Note Associations ===
if (db.StockUsageNote && db.StockUsageNoteItem) {
  db.StockUsageNote.hasMany(db.StockUsageNoteItem, { foreignKey: "note_id", as: "items", onDelete: "CASCADE" });
  db.StockUsageNoteItem.belongsTo(db.StockUsageNote, { foreignKey: "note_id", as: "usageNote" });
}
if (db.StockUsageNote && db.Vehicle) {
  db.StockUsageNote.belongsTo(db.Vehicle, { foreignKey: "vehicle_id", as: "vehicle" });
}
if (db.StockUsageNoteItem && db.StockItem) {
  db.StockUsageNoteItem.belongsTo(db.StockItem, { foreignKey: "item_id", as: "stockItem" });
}

// === Payment-related Associations ===
DeliveryOrder.hasMany(DeliveryOrderPayments, {
  foreignKey: "delivery_order_id",
  as: "payments",
});
DeliveryOrderPayments.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});

DeliveryOrder.hasMany(DeliveryOrderInvoices, {
  foreignKey: "delivery_order_id",
  as: "invoices",
});
DeliveryOrderInvoices.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});

DeliveryOrder.hasMany(DeliveryOrderAdjustments, {
  foreignKey: "delivery_order_id",
  as: "adjustments",
});
DeliveryOrderAdjustments.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});

DeliveryOrder.hasMany(DeliveryOrderPaymentHistory, {
  foreignKey: "delivery_order_id",
  as: "paymentHistory",
});
DeliveryOrderPaymentHistory.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});
DeliveryOrderPaymentHistory.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changedBy",
});
User.hasMany(DeliveryOrderPaymentHistory, {
  foreignKey: "changed_by",
  as: "paymentHistoryChanges",
});

// BIG DO ASSOCIATIONS
BigDeliveryOrder.belongsTo(DeliveryOrder, {
  foreignKey: "main_delivery_order_id",
  as: "mainDeliveryOrder",
});

BigDeliveryOrder.belongsTo(User, {
  foreignKey: "driver_id",
  as: "driver",
});

BigDeliveryOrder.belongsTo(Vehicle, {
  foreignKey: "vehicle_id",
  as: "vehicle",
});

BigDeliveryOrder.hasMany(BigDoTambahan, {
  foreignKey: "big_delivery_order_id",
  as: "tambahan",
});

// Tambahan associations
BigDoTambahan.belongsTo(BigDeliveryOrder, {
  foreignKey: "big_delivery_order_id",
  as: "bigDeliveryOrder",
});

// Enhanced DO associations (NEW)
DeliveryOrder.hasOne(BigDeliveryOrder, {
  foreignKey: "main_delivery_order_id",
  as: "bigDeliveryOrderAsMain",
});

// Invoice to Payments relationship
DeliveryOrderInvoices.hasMany(DeliveryOrderPayments, {
  foreignKey: "invoice_id",
  as: "payments",
});
DeliveryOrderPayments.belongsTo(DeliveryOrderInvoices, {
  foreignKey: "invoice_id",
  as: "invoice",
});

// User relationships for audit fields
User.hasMany(DeliveryOrderPayments, {
  foreignKey: "created_by",
  as: "createdPayments",
});
User.hasMany(DeliveryOrderPayments, {
  foreignKey: "received_by",
  as: "receivedPayments",
});
User.hasMany(DeliveryOrderInvoices, {
  foreignKey: "created_by",
  as: "createdInvoices",
});
User.hasMany(DeliveryOrderAdjustments, {
  foreignKey: "created_by",
  as: "createdAdjustments",
});
User.hasMany(DeliveryOrderAdjustments, {
  foreignKey: "approved_by",
  as: "approvedAdjustments",
});
User.hasMany(SystemSettings, {
  foreignKey: "updated_by",
  as: "updatedSettings",
});

// === Tire Management Associations ===
Vehicle.hasMany(VehicleTire, {
  foreignKey: "vehicle_id",
  as: "tires",
});
VehicleTire.belongsTo(Vehicle, {
  foreignKey: "vehicle_id",
  as: "vehicle",
});

TireInventory.hasMany(VehicleTire, {
  foreignKey: "tire_inventory_id",
  as: "installedTires",
});
VehicleTire.belongsTo(TireInventory, {
  foreignKey: "tire_inventory_id",
  as: "tireInventory",
});

VehicleTire.hasMany(TireInspection, {
  foreignKey: "vehicle_tire_id",
  as: "inspections",
});
TireInspection.belongsTo(VehicleTire, {
  foreignKey: "vehicle_tire_id",
  as: "vehicleTire",
});

TireInventory.hasMany(TireInstance, {
  foreignKey: "tire_inventory_id",
  as: "instances",
});
TireInstance.belongsTo(TireInventory, {
  foreignKey: "tire_inventory_id",
  as: "tireInventory",
});

VehicleTire.belongsTo(TireInstance, {
  foreignKey: "tire_instance_id",
  as: "tireInstance",
});
TireInstance.hasMany(VehicleTire, {
  foreignKey: "tire_instance_id",
  as: "installations",
});

TireInspection.belongsTo(TireInstance, {
  foreignKey: "tire_instance_id",
  as: "tireInstance",
});
TireInstance.hasMany(TireInspection, {
  foreignKey: "tire_instance_id",
  as: "inspections",
});

// === Cash Management Associations ===
CashCategory.hasMany(CashTransaction, {
  foreignKey: "category_id",
  as: "transactions",
});
CashTransaction.belongsTo(CashCategory, {
  foreignKey: "category_id",
  as: "category",
});

// DepositGroup to DepositGroupMember (One-to-Many)
DepositGroup.hasMany(DepositGroupMember, {
  foreignKey: "group_id",
  as: "members",
});
DepositGroupMember.belongsTo(DepositGroup, {
  foreignKey: "group_id",
  as: "depositGroup",
});

// DeliveryOrder to DepositGroupMember (One-to-Many)
DeliveryOrder.hasMany(DepositGroupMember, {
  foreignKey: "delivery_order_id",
  as: "groupMemberships",
});
DepositGroupMember.belongsTo(DeliveryOrder, {
  foreignKey: "delivery_order_id",
  as: "deliveryOrder",
});
DeliveryOrder.hasMany(DeliveryOrderPayments, {
  foreignKey: 'delivery_order_id',
  as: 'payments_depositGroup',
});

PurchaseOrder.belongsTo(DepositGroup, {
  foreignKey: "deposit_group_id",
  as: "depositGroup",
});
DepositGroup.hasMany(PurchaseOrder, {
  foreignKey: "deposit_group_id",
  as: "purchaseOrders",
});

// DepositGroup to DepositGroupInvoice (One-to-Many)
DepositGroup.hasMany(DepositGroupInvoice, {
  foreignKey: "group_id",
  as: "invoices",
});
DepositGroupInvoice.belongsTo(DepositGroup, {
  foreignKey: "group_id",
  as: "depositGroup",
});

// DepositGroupInvoice to DepositGroupPayment (One-to-Many)
DepositGroupInvoice.hasMany(DepositGroupPayment, {
  foreignKey: "invoice_id",
  as: "payments",
});
DepositGroupPayment.belongsTo(DepositGroupInvoice, {
  foreignKey: "invoice_id",
  as: "invoice",
});

// DepositGroup to Topups (One-to-Many)
DepositGroup.hasMany(DepositGroupTopup, { foreignKey: "group_id", as: "topups" });
DepositGroupTopup.belongsTo(DepositGroup, { foreignKey: "group_id", as: "depositGroup" });

CashTransaction.hasOne(TempoDetail, { foreignKey: "cash_transaction_id", as: "tempoDetail" });
TempoDetail.belongsTo(CashTransaction, { foreignKey: "cash_transaction_id", as: "cashTransaction" });

module.exports = db;