const { PurchaseOrder, DeliveryOrder, Sequelize } = require('../models');

// GET /api/purchase-orders - Get all POs with a count of their DOs
exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const purchaseOrders = await PurchaseOrder.findAll({
      attributes: {
        include: [
          [Sequelize.fn("COUNT", Sequelize.col("deliveryOrders.id")), "total_delivery_orders"],
          [Sequelize.fn("SUM", Sequelize.literal("CASE WHEN \"deliveryOrders\".\"status\" = 'completed' THEN 1 ELSE 0 END")), "completed_delivery_orders"]
        ]
      },
      include: [{
        model: DeliveryOrder,
        as: 'deliveryOrders',
        attributes: [] // Don't include the actual DOs in this list view
      }],
      group: ['PurchaseOrder.id'],
      order: [['order_date', 'DESC']],
    });
    res.json(purchaseOrders);
  } catch (err) {
    next(err);
  }
};

// GET /api/purchase-orders/:id - Get a single PO with all its DOs
exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [{
        model: DeliveryOrder,
        as: 'deliveryOrders', // This alias must match the one in models/index.js
        include: ['driver', 'vehicle'] // Eager load driver and vehicle info for each DO
      }]
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase Order not found' });
    }
    res.json(purchaseOrder);
  } catch (err) {
    next(err);
  }
};

// ... other methods like create, update, delete
