// src/models/stockUsageNoteItem.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const StockUsageNoteItem = sequelize.define(
		"StockUsageNoteItem",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			note_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "stock_usage_notes",
					key: "id",
				},
			},
			item_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "stock_items",
					key: "id",
				},
			},
			quantity: {
				type: DataTypes.DECIMAL(10, 2),
				allowNull: false,
			},
			unit_price: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			total_price: {
				type: DataTypes.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			from_stock: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			created_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: "stock_usage_note_items",
			timestamps: false,
		}
	);

	return StockUsageNoteItem;
};
