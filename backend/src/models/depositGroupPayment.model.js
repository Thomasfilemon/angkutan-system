const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const DepositGroupPayment = sequelize.define(
		"DepositGroupPayment",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			invoice_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: { model: "deposit_group_invoices", key: "id" },
			},
			payment_amount: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
			},
			payment_date: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			method: {
				type: DataTypes.STRING(30),
				allowNull: true,
			},
			reference_number: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			created_by: {
				type: DataTypes.INTEGER,
				allowNull: true,
				references: { model: "users", key: "id" },
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
			tableName: "deposit_group_payments",
			timestamps: false,
			indexes: [{ fields: ["invoice_id"] }],
		}
	);

	return DepositGroupPayment;
};
