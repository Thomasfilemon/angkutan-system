// src/models/stockUsageNote.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const StockUsageNote = sequelize.define(
		"StockUsageNote",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			note_number: {
				type: DataTypes.STRING(50),
				unique: true,
				allowNull: false,
			},
			usage_date: {
				type: DataTypes.DATEONLY,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			vehicle_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "vehicles",
					key: "id",
				},
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			created_by: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			created_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: "stock_usage_notes",
			timestamps: false,
		}
	);

	return StockUsageNote;
};
