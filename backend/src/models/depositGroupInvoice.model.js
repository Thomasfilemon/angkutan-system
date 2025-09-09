const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const DepositGroupInvoice = sequelize.define(
		"DepositGroupInvoice",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			group_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: { model: "deposit_groups", key: "id" },
			},
			invoice_number: {
				type: DataTypes.STRING(100),
				allowNull: false,
			},
			invoice_date: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			due_date: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			gross_amount: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			deposit_deducted: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			net_amount: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			status: {
				type: DataTypes.STRING(30),
				allowNull: false,
				defaultValue: "issued", // issued | sent | paid | cancelled
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			created_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
			updated_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: "deposit_group_invoices",
			timestamps: false,
			indexes: [
				{ fields: ["group_id"] },
				{ unique: true, fields: ["invoice_number"] },
			],
		}
	);

	return DepositGroupInvoice;
};
