// src/controllers/deliveryOrder.controller.js

const { DeliveryOrder, PurchaseOrder, Vehicle, User, DriverProfile, sequelize } = require('../models');
const { Op } = require('sequelize');

// A generic function to update status and timestamp
const updateStatus = async (id, driverId, newStatus, timestampField) => {
  const order = await DeliveryOrder.findOne({ where: { id, driver_id: driverId } });
  if (!order) {
    throw { status: 404, message: 'Delivery Order not found or you are not authorized.' };
  }
  
  order[timestampField] = new Date();
  order.status = newStatus;
  
  await order.save();
  return order;
};

// GET /api/delivery-orders/me - Get assigned tasks for the logged-in driver
exports.getMyDeliveryOrders = async (req, res, next) => {
  try {
    const driverId = req.user.id; 

    const myOrders = await DeliveryOrder.findAll({
      where: { driver_id: driverId },
      include: [
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'po_number'] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'license_plate', 'type'] },
        { model: User, as: 'driver', attributes: ['id', 'username'],
          include: [{ model: DriverProfile, as: 'driverProfile', attributes: ['full_name'] }]
        }
      ],
      order: [['created_at', 'DESC']],
    });
    
    const simplifiedOrders = myOrders.map(order => {
        const plainOrder = order.get({ plain: true });
        return {
            ...plainOrder,
            // --- THIS IS THE CORRECTED ALIAS ---
            driver_name: plainOrder.driver?.driverProfile?.full_name || plainOrder.driver?.username,
            driver: undefined 
        };
    });
    res.json(simplifiedOrders);
  } catch (err) {
    console.error('Error in getMyDeliveryOrders:', err);
    next(err);
  }
};

// GET /api/delivery-orders - Get all orders (for admins) or filtered orders
exports.getAllDeliveryOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const user = req.user;
    
    const options = {
      include: [
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['po_number'] },
        { model: Vehicle, as: 'vehicle', attributes: ['license_plate', 'type'] },
        { model: User, as: 'driver', include: { model: DriverProfile, as: 'driverProfile', attributes: ['full_name'] } }
      ],
      order: [['created_at', 'DESC']],
      where: {}
    };

    if (status) {
      options.where.status = { [Op.in]: status.split(',') };
    }

    if (user.role === 'driver') {
      options.where.driver_id = user.id;
    }

    const deliveryOrders = await DeliveryOrder.findAll(options);
    res.json(deliveryOrders);
  } catch (err) {
    console.error('Error in getAllDeliveryOrders:', err);
    next(err);
  }
};

// GET /api/delivery-orders/:id - Get a single order by ID
exports.getDeliveryOrderById = async (req, res, next) => {
    try {
        const order = await DeliveryOrder.findByPk(req.params.id, {
            include: [
                { model: PurchaseOrder, as: 'purchaseOrder' },
                { model: Vehicle, as: 'vehicle' },
                { model: User, as: 'driver', include: { model: DriverProfile, as: 'driverProfile' } }
            ]
        });
        if (!order) return res.status(404).json({ message: 'Delivery Order not found' });
        res.json(order);
    } catch (err) {
        next(err);
    }
};

// PATCH /api/delivery-orders/:id/start
exports.startToDestination = (req, res, next) => {
  updateStatus(req.params.id, req.user.id, 'otw_to_destination', 'started_at')
    .then(order => res.json({ message: 'Status updated to OTW to Destination', order }))
    .catch(next);
};

// PATCH /api/delivery-orders/:id/arrive
exports.arriveAtDestination = (req, res, next) => {
  updateStatus(req.params.id, req.user.id, 'at_destination', 'reached_destination_at')
    .then(order => res.json({ message: 'Status updated to At Destination', order }))
    .catch(next);
};

// PATCH /api/delivery-orders/:id/return
exports.startReturnToBase = (req, res, next) => {
    updateStatus(req.params.id, req.user.id, 'otw_to_base', 'started_return_at')
      .then(order => res.json({ message: 'Status updated to OTW to Base', order }))
      .catch(next);
};

// PATCH /api/delivery-orders/:id/complete
exports.completeDeliveryOrder = async (req, res, next) => {
  try {
    await sequelize.transaction(async (t) => {
      const order = await DeliveryOrder.findOne({ where: { id: req.params.id, driver_id: req.user.id }, transaction: t });
      if (!order) throw { status: 404, message: 'Delivery Order not found.' };

      await order.update({ status: 'completed', completed_at: new Date() }, { transaction: t });
      await DriverProfile.update({ status: 'available' }, { where: { user_id: req.user.id }, transaction: t });
      await Vehicle.update({ status: 'available' }, { where: { id: order.vehicle_id }, transaction: t });
    });
    res.json({ message: 'Delivery Order completed successfully!' });
  } catch (err) {
    next(err);
  }
};
