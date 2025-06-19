// src/controllers/purchaseOrder.controller.js

const { PurchaseOrder, DeliveryOrder, sequelize } = require('../models');

// GET all purchase orders
exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { status, customer } = req.query;
    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }
    if (customer) {
      whereClause.customer_name = {
        [require('sequelize').Op.iLike]: `%${customer}%`
      };
    }

    const purchaseOrders = await PurchaseOrder.findAll({
      where: whereClause,
      include: [{
        model: DeliveryOrder,
        as: 'deliveryOrders',
        attributes: ['id', 'do_number', 'quantity', 'status']
      }],
      order: [['created_at', 'DESC']]
    });

    res.json(purchaseOrders);
  } catch (err) {
    next(err);
  }
};

// GET single purchase order by ID
exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [{
        model: DeliveryOrder,
        as: 'deliveryOrders',
        include: ['driver', 'vehicle']
      }]
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    res.json(purchaseOrder);
  } catch (err) {
    next(err);
  }
};

// POST create new purchase order
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const newPO = await PurchaseOrder.create(req.body);
    res.status(201).json(newPO);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        details: messages.join('. ') 
      });
    }
    next(err);
  }
};

// PUT update purchase order
exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchaseOrder = await PurchaseOrder.findByPk(id);
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const updatedPO = await purchaseOrder.update(req.body);
    res.json(updatedPO);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        details: messages.join('. ') 
      });
    }
    next(err);
  }
};

// DELETE purchase order
exports.deletePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchaseOrder = await PurchaseOrder.findByPk(id);
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Check if there are any delivery orders linked to this PO
    const deliveryOrders = await DeliveryOrder.findAll({
      where: { purchase_order_id: id }
    });

    if (deliveryOrders.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete purchase order with existing delivery orders' 
      });
    }

    await purchaseOrder.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// GET active purchase orders (for creating delivery orders)
exports.getActivePurchaseOrders = async (req, res, next) => {
  try {
    const activePOs = await PurchaseOrder.findActive();
    res.json(activePOs);
  } catch (err) {
    next(err);
  }
};
