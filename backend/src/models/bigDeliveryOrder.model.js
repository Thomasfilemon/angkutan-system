// src/models/bigDeliveryOrder.model.js
const { DataTypes, Sequelize } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize) => {
  const BigDeliveryOrder = sequelize.define(
    "BigDeliveryOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // === FOREIGN KEYS ===
      main_delivery_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Reference to the main delivery order",
      },
      driver_id: { type: DataTypes.INTEGER, allowNull: false },
      vehicle_id: { type: DataTypes.INTEGER, allowNull: false },

      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "User who created this Big DO",
      },

      // === BASIC INFO ===
      big_do_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: "Big DO number: BigDO-20250630-001",
      },

      // === FINANCIAL AGGREGATION ===
      total_trip_allowance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Single trip allowance for entire Big DO",
        validate: { min: 0 },
      },
      total_gaji: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Sum of main DO gaji + driver portion for tambahan",
        validate: { min: 0 },
      },
      total_ongkosan: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Sum of main DO ongkosan + profit from tambahan",
        validate: { min: 0 },
      },

      // === STATUS ===
      status: {
        type: DataTypes.ENUM(
          "assigned",
          "in_progress",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "assigned",
      },

      // === TIMESTAMPS ===
      created_at: {
        type: DataTypes.DATE,
        field: "created_at",
        defaultValue: Sequelize.NOW,
      },
      started_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },

      // === NOTES ===
      notes: { type: DataTypes.TEXT },
      cancellation_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "big_delivery_orders",
      timestamps: false,
    }
  );

  // === INSTANCE METHODS ===
  BigDeliveryOrder.prototype.getStatusText = function () {
    const statusMap = {
      assigned: "Ditugaskan",
      in_progress: "Sedang Berlangsung",
      completed: "Selesai",
      cancelled: "Dibatalkan",
    };
    return statusMap[this.status] || this.status;
  };

  BigDeliveryOrder.prototype.canStart = function () {
    return this.status === "assigned";
  };

  BigDeliveryOrder.prototype.canComplete = function () {
    return this.status === "in_progress";
  };

  BigDeliveryOrder.prototype.canCancel = function () {
    return ["assigned", "in_progress"].includes(this.status);
  };

  BigDeliveryOrder.prototype.getFinancialSummary = function () {
    const mainDOAmount = parseFloat(this.mainDeliveryOrder?.ongkosan || 0);
    const tambahanTotalAmount =
      this.tambahan?.reduce((sum, t) => sum + parseFloat(t.total_amount), 0) ||
      0;

    return {
      main_do_amount: mainDOAmount,
      tambahan_total_amount: tambahanTotalAmount,
      total_revenue: mainDOAmount + tambahanTotalAmount,
      total_trip_allowance: parseFloat(this.total_trip_allowance) || 0,
      total_gaji: parseFloat(this.total_gaji) || 0,
      total_ongkosan: parseFloat(this.total_ongkosan) || 0,
      total_for_driver:
        (parseFloat(this.total_trip_allowance) || 0) +
        (parseFloat(this.total_gaji) || 0),
      net_profit:
        (parseFloat(this.total_ongkosan) || 0) -
        ((parseFloat(this.total_trip_allowance) || 0) +
          (parseFloat(this.total_gaji) || 0)),
    };
  };

  BigDeliveryOrder.prototype.getTotalQuantity = function () {
    const mainQuantity = parseFloat(
      this.mainDeliveryOrder?.actual_load_quantity ||
        this.mainDeliveryOrder?.minimal_load_quantity ||
        0
    );
    const tambahanQuantity =
      this.tambahan?.reduce((sum, t) => sum + parseFloat(t.quantity), 0) || 0;

    return {
      main_do_quantity: mainQuantity,
      tambahan_quantity: tambahanQuantity,
      total_quantity: mainQuantity + tambahanQuantity,
      main_unit: this.mainDeliveryOrder?.unit || "ton",
    };
  };

  BigDeliveryOrder.prototype.getDeliveryProgress = function () {
    const mainCompleted = this.mainDeliveryOrder?.status === "completed";
    const tambahanCompleted =
      this.tambahan?.filter((t) => t.status === "delivered").length || 0;
    const totalTambahan = this.tambahan?.length || 0;

    return {
      main_do_completed: mainCompleted,
      tambahan_completed: tambahanCompleted,
      total_tambahan: totalTambahan,
      completion_percentage:
        totalTambahan > 0
          ? (((mainCompleted ? 1 : 0) + tambahanCompleted) /
              (1 + totalTambahan)) *
            100
          : mainCompleted
          ? 100
          : 0,
    };
  };

  // 🎯 Static method for generating Big DO numbers (FIXED: Added UUID suffix for batch/concurrency safety)
  BigDeliveryOrder.generateBigDONumber = async function () {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    // Find highest sequence for today
    const lastBigDO = await BigDeliveryOrder.findOne({
      where: {
        big_do_number: {
          [sequelize.Sequelize.Op.like]: `BigDO-${date}-%`,
        },
      },
      order: [["big_do_number", "DESC"]],
    });

    let sequence = 1;
    if (lastBigDO) {
      const lastSequence = parseInt(lastBigDO.big_do_number.split("-")[2]);
      sequence = lastSequence + 1;
    }

    // Add short UUID suffix for uniqueness (prevents race/duplicates in batch)
    const shortUUID = uuidv4().slice(0, 6).toUpperCase(); // 6 chars, collision-proof

    return `BigDO-${date}-${sequence.toString().padStart(3, "0")}-${shortUUID}`;
  };

  return BigDeliveryOrder;
};
