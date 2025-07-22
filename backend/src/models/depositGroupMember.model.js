// src/models/depositGroupMember.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DepositGroupMember = sequelize.define(
    "DepositGroupMember",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "deposit_groups",
          key: "id",
        },
        comment: "Reference to deposit group",
      },
      quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: "Current balance of the group",
      },
      delivery_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "delivery_orders",
          key: "id",
        },
        comment: "Reference to delivery order",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
    },
    {
      tableName: "deposit_group_members",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["group_id", "delivery_order_id"],
          name: "unique_group_do",
        },
        {
          fields: ["group_id"],
        },
        {
          fields: ["delivery_order_id"],
        },
      ],
    }
  );

  // Instance method to get DO details with payment info
  DepositGroupMember.prototype.getDOWithPayment = async function() {
    return sequelize.query(
      `SELECT 
        do.id,
        do.do_number,
        do.customer_name,
        do.final_amount,
        COALESCE(p.total_paid, 0) AS paid_amount,
        (do.final_amount - COALESCE(p.total_paid, 0)) AS unpaid_amount
      FROM delivery_orders do
      LEFT JOIN (
        SELECT delivery_order_id, SUM(payment_amount) AS total_paid
        FROM delivery_order_payments
        GROUP BY delivery_order_id
      ) p ON do.id = p.delivery_order_id
      WHERE do.id = :doId`,
      {
        replacements: { doId: this.delivery_order_id },
        type: sequelize.QueryTypes.SELECT
      }
    );
  };

  return DepositGroupMember;
};