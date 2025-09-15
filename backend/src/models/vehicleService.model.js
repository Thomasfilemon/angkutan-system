// src/models/vehicleService.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const VehicleService = sequelize.define(
    "VehicleService",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vehicle_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "vehicles",
          key: "id",
        },
      },
      service_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        // Add automatic generation
        defaultValue: () => {
          const date = new Date();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const timestamp = Date.now().toString().slice(-6);
          return `SRV-${year}${month}${day}-${timestamp}`;
        },
      },
      service_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      service_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: {
            args: [["regular", "with_parts"]],
            msg: "Service type must be regular or with_parts",
          },
        },
        defaultValue: "regular",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      workshop_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      labor_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      parts_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "completed",
        validate: {
          isIn: {
            args: [["completed", "cancelled"]],
            msg: "Status must be completed or cancelled",
          },
        },
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Audit
      last_edited_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      last_edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: "vehicle_services",
      timestamps: false,
      hooks: {
        beforeUpdate: (vehicleService) => {
          vehicleService.updated_at = new Date();
        },
        // Alternative: Generate service_number in beforeCreate hook
        beforeCreate: async (vehicleService) => {
          if (!vehicleService.service_number) {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");

            // Get count of services today for sequential numbering
            const today = new Date().toISOString().split("T")[0];
            const count = await VehicleService.count({
              where: {
                service_date: today,
              },
            });

            const sequence = String(count + 1).padStart(3, "0");
            vehicleService.service_number = `SRV-${year}${month}${day}-${sequence}`;
          }
        },
      },
    }
  );

  return VehicleService;
};
