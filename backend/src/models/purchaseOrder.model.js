// src/models/purchaseOrder.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PurchaseOrder = sequelize.define(
    "PurchaseOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      po_number: { type: DataTypes.STRING, allowNull: false, unique: true },
      customer_name: { type: DataTypes.STRING, allowNull: false },
      item_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Nama barang utama sesuai kontrak PO, separated with comma",
      },
      total_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Total kuantitas barang dalam satu PO",
        validate: {
          min: 0.01,
          isDecimal: true,
        },
      },
      quantity_mutasi: {
        type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
        defaultValue: () => [], // Ensures a fresh array for each new record
        comment: "Riwayat perubahan kuantitas",
      },
      unit: {
        type: DataTypes.ENUM("kilogram", "ton", "kubik"),
        allowNull: false,
        defaultValue: "ton",
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Harga per unit (Rp/ton)",
        validate: {
          min: 0,
          isDecimal: true,
        },
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: "Total nilai PO (auto calculated from DOs)",
        validate: {
          min: 0,
          isDecimal: true,
        },
      },
      // Simplified location handling - text only
      load_location: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Lokasi pemuatan barang (optional)",
        validate: {
          len: {
            args: [0, 500],
            msg: "Lokasi loading tidak boleh lebih dari 500 karakter",
          },
        },
      },
      unload_location: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Lokasi pembongkaran barang (optional)",
        validate: {
          len: {
            args: [0, 500],
            msg: "Lokasi unloading tidak boleh lebih dari 500 karakter",
          },
        },
      },
      order_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deposit_group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'deposit_groups',
          key: 'id'
        },
        comment: "Reference to deposit group (optional for prepaid orders)",
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "confirmed",
        validate: {
          isIn: [["confirmed", "partial", "completed", "cancelled"]],
        },
      },
      notes: { type: DataTypes.TEXT },
    },
    {
      tableName: "purchase_orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      hooks: {
        beforeSave: (po) => {
          // Auto-calculate total_amount if unit_price and total_quantity are provided
          if (po.unit_price && po.total_quantity) {
            const quantity = parseFloat(po.total_quantity);
            const unitPrice = parseFloat(po.unit_price);

            switch (po.unit) {
              case "kilogram":
                po.total_amount = quantity * unitPrice;
                break;
              case "ton":
                po.total_amount = quantity * unitPrice;
                break;
              case "kubik":
                po.total_amount = quantity * unitPrice; // Direct kubik pricing
                break;
              default:
                po.total_amount = quantity * unitPrice;
            }
          }
        },
      },
    }
  );

  // === INSTANCE METHODS ===

  // Deposit group integration (from current)
  PurchaseOrder.prototype.isDepositLinked = function () {
    return !!this.deposit_group_id;
  };

  // Location data check (from both)
  PurchaseOrder.prototype.hasLocationData = function () {
    return !!(this.load_location && this.unload_location);
  };

  // Manual total amount calculation (from current)
  PurchaseOrder.prototype.calculateTotalAmount = function () {
    if (this.unit_price && this.total_quantity) {
      const quantity = parseFloat(this.total_quantity);
      const unitPrice = parseFloat(this.unit_price);

      switch (this.unit) {
        case "kilogram":
          return quantity * unitPrice;
        case "ton":
          return quantity * unitPrice;
        case "kubik":
          return quantity * unitPrice; // Direct kubik pricing
        default:
          return quantity * unitPrice;
      }
    }
    return 0;
  };

  // Unit display helper (from both, enhanced from current)
  PurchaseOrder.prototype.getUnitDisplay = function () {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[this.unit] || this.unit;
  };

  // Enhanced price display (from current)
  PurchaseOrder.prototype.getPriceDisplay = function () {
    if (!this.unit_price) {
      return `Unit: ${this.getUnitDisplay()} (Price per DO)`;
    }

    const unitPrice = parseFloat(this.unit_price) || 0;
    const unitDisplay = this.getUnitDisplay();

    if (this.unit === "ton") {
      // Show both per kg and per ton prices
      const pricePerTon = unitPrice;
      return `Rp ${unitPrice.toLocaleString(
        "id-ID"
      )}/${unitDisplay} (Rp ${pricePerTon.toLocaleString("id-ID")}/ton)`;
    }

    return `Rp ${unitPrice.toLocaleString("id-ID")}/${unitDisplay}`;
  };

  // Enhanced remaining quantity and forecast calculation (from incoming)
  PurchaseOrder.prototype.getRemainingAndForecast = async function () {
    try {
      const deliveryOrders = await this.getPoDeliveryOrders(); // Matches association alias

      let fulfilledActual = 0;
      let estimatedPending = 0;

      deliveryOrders.forEach((deliveryOrder) => {
        if (deliveryOrder.status === "completed") {
          fulfilledActual += parseFloat(deliveryOrder.actual_load_quantity) || 0;
        } else {
          estimatedPending +=
            parseFloat(deliveryOrder.minimal_load_quantity) || 0;
        }
      });

      const totalQuantity = parseFloat(this.total_quantity);
      const remaining = totalQuantity - (fulfilledActual + estimatedPending);
      const fulfillmentStatus =
        fulfilledActual + estimatedPending >= totalQuantity
          ? "complete"
          : "partial";

      return {
        total_quantity: totalQuantity,
        fulfilled_actual: fulfilledActual,
        estimated_pending: estimatedPending,
        remaining_quantity: remaining > 0 ? remaining : 0,
        current_total_forecast: this.total_amount, // From database or calculated
        fulfillment_status: fulfillmentStatus,
        delivery_progress: {
          percentage: totalQuantity > 0 ? (fulfilledActual / totalQuantity) * 100 : 0,
          is_complete: remaining <= 0,
        },
      };
    } catch (error) {
      console.error(`Error in getRemainingAndForecast for PO ${this.id}:`, error);
      // Return fallback data
      return {
        total_quantity: parseFloat(this.total_quantity),
        fulfilled_actual: 0,
        estimated_pending: 0,
        remaining_quantity: parseFloat(this.total_quantity),
        current_total_forecast: this.total_amount || 0,
        fulfillment_status: "pending",
        delivery_progress: {
          percentage: 0,
          is_complete: false,
        },
      };
    }
  };

  return PurchaseOrder;
};
