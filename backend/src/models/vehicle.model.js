// src/models/vehicle.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Vehicle = sequelize.define(
    "Vehicle",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      license_plate: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: {
          msg: "License plate already exists",
        },
        validate: {
          notEmpty: {
            msg: "License plate cannot be empty",
          },
          len: {
            args: [5, 20],
            msg: "License plate must be between 5 and 20 characters",
          },
        },
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
          len: {
            args: [0, 50],
            msg: "Vehicle type must not exceed 50 characters",
          },
        },
      },
      capacity: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
          isNumericString(value) {
            if (value !== null && value !== undefined && value !== "") {
              if (!/^\d+$/.test(value.toString().trim())) {
                throw new Error("Capacity must contain only numbers");
              }

              const numValue = parseInt(value, 10);
              if (numValue < 0) {
                throw new Error("Capacity must be a positive number");
              }
              if (numValue > 999999) {
                throw new Error("Capacity cannot exceed 999,999 kg");
              }
            }
          },
        },
      },
      // NEW: Tire configuration fields
      tire_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 6,
        validate: {
          min: {
            args: [2],
            msg: "Vehicle must have at least 2 tires",
          },
          max: {
            args: [18],
            msg: "Vehicle cannot have more than 18 tires",
          },
        },
      },
      spare_tire_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        validate: {
          min: {
            args: [0],
            msg: "Spare tire count cannot be negative",
          },
          max: {
            args: [4],
            msg: "Vehicle cannot have more than 4 spare tires",
          },
        },
      },
      driver_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        validate: {
          async isValidDriver(value) {
            if (value) {
              const { User } = require("./index");
              const driver = await User.findOne({
                where: { id: value, role: "driver" },
              });
              if (!driver) {
                throw new Error("Selected user is not a valid driver");
              }
            }
          },
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "available",
        validate: {
          isIn: {
            args: [["available", "in_use", "maintenance"]], // 🎯 ADD this status
            msg: "Status must be one of: available, in_use, maintenance",
          },
        },
      },
      last_service_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: {
            msg: "Last service date must be a valid date",
          },
        },
      },
      next_service_due: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: {
            msg: "Next service due must be a valid date",
          },
          isAfterLastService(value) {
            if (
              value &&
              this.last_service_date &&
              value <= this.last_service_date
            ) {
              throw new Error(
                "Next service due must be after last service date"
              );
            }
          },
        },
      },
      stnk_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: {
          msg: "STNK number already exists",
        },
        validate: {
          len: {
            args: [0, 50],
            msg: "STNK number must not exceed 50 characters",
          },
        },
      },
      stnk_expired_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: {
            msg: "STNK expired date must be a valid date",
          },
        },
      },
      tax_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: {
            msg: "Tax due date must be a valid date",
          },
        },
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
    },
    {
      tableName: "vehicles",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["license_plate"],
        },
        {
          unique: true,
          fields: ["stnk_number"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["tax_due_date"],
        },
        {
          fields: ["stnk_expired_date"],
        },
        {
          fields: ["driver_id"],
        },
      ],
      hooks: {
        beforeValidate: (vehicle) => {
          if (vehicle.license_plate) {
            vehicle.license_plate = vehicle.license_plate.toUpperCase().trim();
          }
          if (vehicle.stnk_number) {
            vehicle.stnk_number = vehicle.stnk_number.trim();
          }

          if (
            vehicle.capacity !== null &&
            vehicle.capacity !== undefined &&
            vehicle.capacity !== ""
          ) {
            if (typeof vehicle.capacity === "string") {
              const trimmed = vehicle.capacity.trim();
              if (trimmed === "") {
                vehicle.capacity = null;
              } else {
                const parsed = parseInt(trimmed, 10);
                vehicle.capacity = isNaN(parsed) ? null : parsed;
              }
            }
          }
        },
      },
    }
  );

  // Instance methods
  Vehicle.prototype.isAvailable = function () {
    return this.status === "available";
  };

  Vehicle.prototype.isMaintenanceDue = function () {
    if (!this.next_service_due) return false;
    return new Date(this.next_service_due) <= new Date();
  };

  Vehicle.prototype.isTaxDue = function () {
    if (!this.tax_due_date) return false;
    return new Date(this.tax_due_date) <= new Date();
  };

  Vehicle.prototype.isSTNKExpired = function () {
    if (!this.stnk_expired_date) return false;
    return new Date(this.stnk_expired_date) <= new Date();
  };

  // NEW: Get total tire count including spares
  Vehicle.prototype.getTotalTireCount = function () {
    return this.tire_count + this.spare_tire_count;
  };

  // NEW: Get tire positions based on tire count
  Vehicle.prototype.getTirePositions = function () {
    const positions = [];

    // Always have front tires
    positions.push("FL", "FR");

    // Add rear tires based on count
    const rearTireCount = this.tire_count - 2;
    const rearAxles = Math.ceil(rearTireCount / 2);

    for (let axle = 1; axle <= rearAxles; axle++) {
      positions.push(`RL${axle}`, `RR${axle}`);
    }

    // Add spare tires
    for (let spare = 1; spare <= this.spare_tire_count; spare++) {
      positions.push(`SPARE${spare}`);
    }

    return positions;
  };

  return Vehicle;
};
