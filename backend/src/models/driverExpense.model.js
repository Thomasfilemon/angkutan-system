
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverExpense = sequelize.define('DriverExpense', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    delivery_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'delivery_orders',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    driver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    jenis: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Expense type cannot be empty'
        },
        isIn: {
          args: [['bbm', 'tol', 'parkir', 'makan', 'lainnya']],
          msg: 'Expense type must be one of: bbm, tol, parkir, makan, lainnya'
        }
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        isDecimal: {
          msg: 'Amount must be a valid decimal number'
        },
        min: {
          args: 0.01,
          msg: 'Amount must be greater than 0'
        },
        max: {
          args: 99999999999.99,
          msg: 'Amount exceeds maximum allowed value'
        }
      }
    },
    receipt_url: {
      type: DataTypes.TEXT,
      allowNull: true // No validation needed for a simple path string
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Notes must not exceed 500 characters'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'driver_expenses',
    timestamps: false,
    indexes: [
      {
        fields: ['delivery_order_id']
      },
      {
        fields: ['driver_id']
      },
      {
        fields: ['jenis']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['delivery_order_id', 'jenis']
      }
    ],
    hooks: {
      beforeValidate: (expense) => {
        if (expense.jenis) {
          expense.jenis = expense.jenis.toLowerCase().trim();
        }
        if (expense.notes) {
          expense.notes = expense.notes.trim();
        }
      }
    }
  });

  // Instance methods
  DriverExpense.prototype.getFormattedAmount = function() {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(this.amount);
  };

  DriverExpense.prototype.hasReceipt = function() {
    return !!this.receipt_url;
  };

  DriverExpense.prototype.getExpenseTypeLabel = function() {
    const labels = {
      'bbm': 'BBM/Solar',
      'tol': 'Biaya Tol',
      'parkir': 'Biaya Parkir',
      'makan': 'Biaya Makan',
      'lainnya': 'Lain-lain'
    };
    return labels[this.jenis] || this.jenis;
  };

  // Class methods
  DriverExpense.findByDeliveryOrder = function(deliveryOrderId) {
    return this.findAll({
      where: { delivery_order_id: deliveryOrderId },
      include: [{
        association: 'driver',
        attributes: ['id', 'username'],
        include: [{
          association: 'profile',
          attributes: ['full_name']
        }]
      }],
      order: [['created_at', 'DESC']]
    });
  };

  DriverExpense.findByDriver = function(driverId, options = {}) {
    const whereClause = { driver_id: driverId };
    
    if (options.deliveryOrderId) {
      whereClause.delivery_order_id = options.deliveryOrderId;
    }
    
    if (options.expenseType) {
      whereClause.jenis = options.expenseType;
    }

    return this.findAll({
      where: whereClause,
      include: [{
        association: 'DeliveryOrder',
        attributes: ['do_number', 'customer_name']
      }],
      order: [['created_at', 'DESC']]
    });
  };

  DriverExpense.getTotalByDeliveryOrder = function(deliveryOrderId) {
    return this.sum('amount', {
      where: { delivery_order_id: deliveryOrderId }
    });
  };

  DriverExpense.getTotalByType = function(deliveryOrderId, expenseType) {
    return this.sum('amount', {
      where: { 
        delivery_order_id: deliveryOrderId,
        jenis: expenseType
      }
    });
  };

  DriverExpense.getExpensesSummary = function(filters = {}) {
    const { Op } = require('sequelize');
    const whereClause = {};

    if (filters.driverId) {
      whereClause.driver_id = filters.driverId;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.created_at = {};
      if (filters.startDate) {
        whereClause.created_at[Op.gte] = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.created_at[Op.lte] = filters.endDate;
      }
    }

    return this.findAll({
      attributes: [
        'jenis',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      where: whereClause,
      group: ['jenis'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });
  };

  DriverExpense.associate = function(models) {
    // An expense belongs to one DeliveryOrder
    DriverExpense.belongsTo(models.DeliveryOrder, {
      foreignKey: 'delivery_order_id',
      as: 'DeliveryOrder' // This alias must match the one used in your 'include'
    });

    // An expense belongs to one User (acting as a driver)
    DriverExpense.belongsTo(models.User, {
      foreignKey: 'driver_id',
      as: 'driver' // This alias must match
    });
  };

  return DriverExpense

  
};