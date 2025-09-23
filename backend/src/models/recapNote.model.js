// src/models/recapNote.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const RecapNote = sequelize.define(
		"RecapNote",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			recap_number: {
				type: DataTypes.STRING(50),
				unique: true,
				allowNull: false,
			},
			recap_date: {
				type: DataTypes.DATEONLY,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			payment_mode: {
				type: DataTypes.ENUM("cash", "tempo"),
				allowNull: false,
			},
			supplier: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			vehicle_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				references: { model: "vehicles", key: "id" },
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			total_amount: {
				type: DataTypes.DECIMAL(15, 2),
				defaultValue: 0,
			},
			paid_amount: {
				type: DataTypes.DECIMAL(15, 2),
				defaultValue: 0,
			},
			status: {
				type: DataTypes.ENUM("open", "partial", "paid"),
				defaultValue: "open",
			},
			created_by: {
				type: DataTypes.STRING(255),
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
		{ tableName: "recap_notes", timestamps: false }
	);

	return RecapNote;
};
