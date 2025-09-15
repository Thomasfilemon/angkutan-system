const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const CashTransaction = sequelize.define(
    "CashTransaction",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      transaction_type: {
        type: DataTypes.ENUM("debit", "kredit", "debit_tempo", "kredit_tempo"), // Added new types
        allowNull: false,
      },
      category_id: {
        type: DataTypes.INTEGER,
        references: {
          model: "cash_categories",
          key: "id",
        },
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      reference_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      account: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      transaction_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      attachment_urls: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
      no_nota: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
      date_nota: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
      supplier: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tanggal_jatuh_tempo: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      // Audit fields
      last_edited_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      last_edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "cash_transactions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return CashTransaction;
};
