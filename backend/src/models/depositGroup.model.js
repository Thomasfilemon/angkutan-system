// src/models/depositGroup.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DepositGroup = sequelize.define(
    "DepositGroup",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Name of the deposit group",
      },
      balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "Current balance of the group",
      },
      target_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Target quantity for this deposit group",
      },
      deposited_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Amount deposited by customer",
      },
      remaining_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Remaining quantity to be fulfilled",
      },
      unit: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'ton',
        validate: {
          isIn: [['kilogram', 'ton', 'kubik']]
        },
        comment: "Unit of measurement",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: [['active', 'fulfilled', 'overdrawn']]
        },
        comment: "Status of the deposit group",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      tableName: "deposit_groups",
      timestamps: false,
      hooks: {
        beforeUpdate: (group) => {
          group.updated_at = new Date();
        },
        // ✅ ADD THIS: Prevent negative values
        beforeSave: (grp) => {
          if (grp.remaining_quantity < 0) grp.remaining_quantity = 0;
          if (grp.balance < 0) grp.balance = 0;
        }
      },
    }
  );
  

  // Instance methods
  DepositGroup.prototype.getStatus = async function() {
    const unpaidTotal = await sequelize.query(
      `SELECT SUM(do.final_amount - COALESCE(p.total_paid, 0)) AS total_unpaid
       FROM deposit_group_members dgm
       JOIN delivery_orders do ON do.id = dgm.delivery_order_id
       LEFT JOIN (
         SELECT delivery_order_id, SUM(payment_amount) AS total_paid
         FROM delivery_order_payments
         GROUP BY delivery_order_id
       ) p ON do.id = p.delivery_order_id
       WHERE dgm.group_id = :groupId`,
      {
        replacements: { groupId: this.id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const totalUnpaid = parseFloat(unpaidTotal[0]?.total_unpaid || 0);
    
    if (totalUnpaid > this.balance) {
      return 'butuh bayar';
    } else if (this.balance > totalUnpaid) {
      return 'extra saldo';
    }
    return 'normal';
  };

  DepositGroup.prototype.reduceQuantity = async function (amount) {
    this.remaining_quantity -= amount;
    if (this.remaining_quantity <= 0) this.status = 'fulfilled';
    else if (this.remaining_quantity < 0) this.status = 'overdrawn';
    await this.save();
  };

  // Calculate selisih across DOs
  DepositGroup.prototype.calculateSelisih = async function () {
    const members = await this.getMembers(); // Assuming association
    let totalExcess = 0;
    members.forEach(member => {
      const deliveryOrder = member.deliveryOrder; // Renamed from 'do' to avoid keyword conflict
      const excess = deliveryOrder.actual_load_quantity - deliveryOrder.minimal_load_quantity;
      if (excess > 0) totalExcess += excess;
    });
    return totalExcess;
  };

  return DepositGroup;
};
