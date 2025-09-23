// src/models/recapNoteItem.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const RecapNoteItem = sequelize.define(
		"RecapNoteItem",
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			recap_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: { model: "recap_notes", key: "id" },
			},
			type: {
				type: DataTypes.ENUM("service", "stock", "stock_usage", "cash", "tire_purchase"),
				allowNull: false,
			},
			reference_id: { type: DataTypes.INTEGER, allowNull: true },
			description: { type: DataTypes.TEXT, allowNull: false },
			amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
			created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
		},
		{ tableName: "recap_note_items", timestamps: false }
	);

	return RecapNoteItem;
};
