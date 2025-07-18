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

  return DepositGroup;
};