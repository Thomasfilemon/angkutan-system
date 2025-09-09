const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DepositGroupTopup = sequelize.define(
    "DepositGroupTopup",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "deposit_groups", key: "id" },
      },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      tableName: "deposit_group_topups",
      timestamps: false,
      indexes: [{ fields: ["group_id"] }],
    }
  );

  return DepositGroupTopup;
};


