// src/models/systemSettings.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SystemSettings = sequelize.define(
    "SystemSettings",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      setting_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: {
          msg: "Setting key must be unique",
        },
        validate: {
          notEmpty: {
            msg: "Setting key cannot be empty",
          },
        },
      },
      setting_value: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Setting value cannot be empty",
          },
        },
      },
      data_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "string",
        validate: {
          isIn: {
            args: [["string", "number", "boolean", "json"]],
            msg: "Data type must be string, number, boolean, or json",
          },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Human readable description of the setting",
      },
      is_editable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Whether this setting can be modified via UI",
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      tableName: "system_settings",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["setting_key"],
        },
        {
          fields: ["data_type"],
        },
      ],
      hooks: {
        beforeUpdate: (setting) => {
          setting.updated_at = new Date();
        },
      },
    }
  );

  // Class methods
  SystemSettings.getSettingValue = async function (key, defaultValue = null) {
    try {
      const setting = await this.findOne({ where: { setting_key: key } });
      if (!setting) return defaultValue;

      // Parse value based on data type
      switch (setting.data_type) {
        case "number":
          return parseFloat(setting.setting_value);
        case "boolean":
          return setting.setting_value.toLowerCase() === "true";
        case "json":
          return JSON.parse(setting.setting_value);
        default:
          return setting.setting_value;
      }
    } catch (error) {
      console.error("Error getting setting value:", error);
      return defaultValue;
    }
  };

  SystemSettings.updateSetting = async function (key, value, updatedBy = null) {
    try {
      const setting = await this.findOne({ where: { setting_key: key } });
      if (!setting) {
        throw new Error(`Setting '${key}' not found`);
      }

      if (!setting.is_editable) {
        throw new Error(`Setting '${key}' is not editable`);
      }

      // Convert value to string based on data type
      let stringValue;
      switch (setting.data_type) {
        case "json":
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = value.toString();
      }

      return await setting.update({
        setting_value: stringValue,
        updated_by: updatedBy,
        updated_at: new Date(),
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      throw error;
    }
  };

  // Instance methods
  SystemSettings.prototype.getParsedValue = function () {
    switch (this.data_type) {
      case "number":
        return parseFloat(this.setting_value);
      case "boolean":
        return this.setting_value.toLowerCase() === "true";
      case "json":
        return JSON.parse(this.setting_value);
      default:
        return this.setting_value;
    }
  };

  SystemSettings.prototype.getFormattedValue = function () {
    const value = this.getParsedValue();
    switch (this.data_type) {
      case "number":
        return value.toLocaleString("id-ID");
      case "boolean":
        return value ? "Ya" : "Tidak";
      case "json":
        return JSON.stringify(value, null, 2);
      default:
        return value.toString();
    }
  };

  return SystemSettings;
};
