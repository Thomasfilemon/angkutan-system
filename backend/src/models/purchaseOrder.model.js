// src/models/purchaseOrder.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    po_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        msg: 'PO number already exists'
      },
      validate: {
        notEmpty: {
          msg: 'PO number cannot be empty'
        }
      }
    },
    customer_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Customer name cannot be empty'
        }
      }
    },
    load_location: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Load location cannot be empty'
        }
      }
    },
    load_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    load_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    unload_location: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Unload location cannot be empty'
        }
      }
    },
    unload_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    unload_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    item_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Item name cannot be empty'
        }
      }
    },
    total_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0.01],
          msg: 'Total quantity must be greater than 0'
        }
      }
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: {
          msg: 'Order date must be a valid date'
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'in_progress', 'completed', 'cancelled']],
          msg: 'Status must be one of: pending, in_progress, completed, cancelled'
        }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'purchase_orders',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['po_number']
      },
      {
        fields: ['status']
      },
      {
        fields: ['customer_name']
      },
      {
        fields: ['order_date']
      }
    ],
    hooks: {
      beforeValidate: (po) => {
        if (po.po_number) {
          po.po_number = po.po_number.toUpperCase().trim();
        }
        if (po.customer_name) {
          po.customer_name = po.customer_name.trim();
        }
        if (po.item_name) {
          po.item_name = po.item_name.trim();
        }
      }
    }
  });

  // Instance methods
  PurchaseOrder.prototype.getTotalDeliveredQuantity = async function() {
    const DeliveryOrder = require('./deliveryOrder');
    const deliveryOrders = await DeliveryOrder.findAll({
      where: { purchase_order_id: this.id }
    });
    return deliveryOrders.reduce((total, do_item) => total + parseFloat(do_item.quantity || 0), 0);
  };

  PurchaseOrder.prototype.getRemainingQuantity = async function() {
    const delivered = await this.getTotalDeliveredQuantity();
    return parseFloat(this.total_quantity) - delivered;
  };

  PurchaseOrder.prototype.isCompleted = async function() {
    const remaining = await this.getRemainingQuantity();
    return remaining <= 0;
  };

  // Class methods
  PurchaseOrder.findActive = function() {
    return this.findAll({
      where: { 
        status: ['pending', 'in_progress'] 
      },
      order: [['created_at', 'DESC']]
    });
  };

  PurchaseOrder.findByCustomer = function(customerName) {
    return this.findAll({
      where: { 
        customer_name: {
          [require('sequelize').Op.iLike]: `%${customerName}%`
        }
      },
      order: [['created_at', 'DESC']]
    });
  };

  return PurchaseOrder;
};
