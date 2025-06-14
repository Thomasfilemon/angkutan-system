const { DeliveryOrder, PurchaseOrder, Vehicle, User, DriverProfile, sequelize } = require('../models');

// GET /api/delivery-orders/me - Get assigned tasks for the logged-in driver
exports.getMyDeliveryOrders = async (req, res, next) => {
  try {
    // req.user is attached by your verifyToken middleware
    const driverId = req.user.id; 

    const myOrders = await DeliveryOrder.findAll({
      where: { driver_id: driverId },
      // --- THIS IS THE CORRECT, ROBUST WAY TO INCLUDE ASSOCIATED DATA ---
      include: [
        {
          model: PurchaseOrder,
          as: 'purchaseOrder', // The 'as' alias must match models/index.js
          attributes: ['id', 'po_number'] // Only select the columns you need
        },
        {
          model: Vehicle,
          as: 'vehicle', // The 'as' alias must match models/index.js
          attributes: ['id', 'license_plate', 'type']
        },
        {
          // We also want the driver's name, which requires a nested include
          model: User,
          as: 'driver', // The 'as' alias for the User model
          attributes: ['id', 'username'], // Exclude sensitive info like password_hash
          include: [{
            model: DriverProfile,
            as: 'driverProfile', // The 'as' alias for the DriverProfile model
            attributes: ['full_name']
          }]
        }
      ],
      order: [['created_at', 'DESC']],
    });
    
    // The raw result is nested. Let's simplify it for the mobile app.
    const simplifiedOrders = myOrders.map(order => {
        // .get({ plain: true }) converts the Sequelize instance to a plain JS object
        const plainOrder = order.get({ plain: true });

        // Create a new, cleaner object to send as a response
        return {
            ...plainOrder,
            // Hoist the nested driver name up to the top level for easier access
            driver_name: plainOrder.driver?.profile?.full_name || plainOrder.driver?.username,
            // Remove the deeply nested driver object to keep the response clean
            driver: undefined 
        };
    });

    res.json(simplifiedOrders);

  } catch (err) {
    // This is your best friend for debugging. ALWAYS check the server console.
    console.error('--- DETAILED ERROR IN getMyDeliveryOrders ---');
    console.error(err); 
    console.error('--- END OF DETAILED ERROR ---');;
    
    // Pass the error to your global error handling middleware
    next(err);
  }
};

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

// PATCH /api/delivery-orders/:id/start
exports.startToDestination = async (req, res, next) => {
  try {
    const order = await updateStatus(req.params.id, req.user.id, 'otw_to_destination', 'started_at');
    res.json({ message: 'Status updated to OTW to Destination', order });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/delivery-orders/:id/arrive
exports.arriveAtDestination = async (req, res, next) => {
  try {
    const order = await updateStatus(req.params.id, req.user.id, 'at_destination', 'reached_destination_at');
    res.json({ message: 'Status updated to At Destination', order });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/delivery-orders/:id/complete
exports.completeDeliveryOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;

    // Use a transaction to ensure all updates succeed or none do
    await sequelize.transaction(async (t) => {
      const order = await DeliveryOrder.findOne({ where: { id, driver_id: driverId }, transaction: t });
      if (!order) {
        throw { status: 404, message: 'Delivery Order not found.' };
      }

      // 1. Update the order
      await order.update({
        status: 'completed',
        completed_at: new Date()
      }, { transaction: t });

      // 2. Free up the driver and vehicle
      await DriverProfile.update({ status: 'available' }, { where: { user_id: driverId }, transaction: t });
      await Vehicle.update({ status: 'available' }, { where: { id: order.vehicle_id }, transaction: t });
    });

    res.json({ message: 'Delivery Order completed successfully!' });
  } catch (err) {
    next(err);
  }
};
