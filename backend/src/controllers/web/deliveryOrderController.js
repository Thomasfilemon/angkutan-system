// src/controllers/web/deliveryOrderController.js
const { DeliveryOrder, PurchaseOrder, Vehicle, DriverProfile, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { Expo } = require('expo-server-sdk');

// Create delivery order with conflict prevention and ongkosan
exports.createDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      purchase_order_id,
      vehicle_id,
      driver_id,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit_price,
      total_amount,
      trip_allowance,
      gaji,
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status = 'proses_tagihan',
      status = 'assigned'
    } = req.body;

    // Validate required fields
    if (!vehicle_id || !driver_id || !minimal_load_quantity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: vehicle_id, driver_id, minimal_load_quantity'
      });
    }

    // Check if driver is already assigned to an active delivery
    const activeDriverDelivery = await DeliveryOrder.findOne({
      where: {
        driver_id,
        status: {
          [Op.in]: ['assigned', 'otw_to_load_location', 'at_load_location', 
                   'otw_to_unload_location', 'at_unload_location', 'otw_to_base']
        }
      },
      transaction
    });

    if (activeDriverDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Driver is already assigned to active delivery order: ${activeDriverDelivery.do_number}`
      });
    }

    // Check if vehicle is already assigned to an active delivery
    const activeVehicleDelivery = await DeliveryOrder.findOne({
      where: {
        vehicle_id,
        status: {
          [Op.in]: ['assigned', 'otw_to_load_location', 'at_load_location', 
                   'otw_to_unload_location', 'at_unload_location', 'otw_to_base']
        }
      },
      transaction
    });

    if (activeVehicleDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Vehicle is already assigned to active delivery order: ${activeVehicleDelivery.do_number}`
      });
    }

    // Generate unique DO number with timestamp and random suffix
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    let do_number = `DO-${timestamp}-${randomSuffix}`;
    
    // Ensure DO number is unique
    let attempts = 0;
    while (attempts < 10) {
      const existingDO = await DeliveryOrder.findOne({
        where: { do_number },
        transaction
      });
      
      if (!existingDO) break;
      
      attempts++;
      const newRandomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      do_number = `DO-${timestamp}-${newRandomSuffix}`;
    }

    if (attempts >= 10) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique DO number. Please try again.'
      });
    }

    // Create delivery order
    const deliveryOrder = await DeliveryOrder.create({
      purchase_order_id,
      driver_id,
      vehicle_id,
      do_number,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit_price,
      total_amount,
      trip_allowance,
      gaji,
      ongkosan,
      load_location,
      load_latitude,
      load_longitude,
      unload_location,
      unload_latitude,
      unload_longitude,
      payment_status,
      status
    }, { transaction });

    // Update vehicle status only (remove DriverProfile status update)
    await Vehicle.update(
      { status: 'in_use' },
      { where: { id: vehicle_id }, transaction }
    );

    // === SEND PUSH NOTIFICATION TO DRIVER ===
    const driverUser = await User.findOne({
      where: { id: driver_id },
      attributes: ['username', 'expo_push_token'],
      transaction
    });

    const driverProfile = await DriverProfile.findOne({
      where: { user_id: driver_id },
      attributes: ['full_name'],
      transaction
    });
    const driverName = driverProfile?.full_name || driverUser.username || 'Driver';

    if (driverUser && driverUser.expo_push_token) {
      const expo = new Expo();
      if (Expo.isExpoPushToken(driverUser.expo_push_token)) {
        const messages = [{
          to: driverUser.expo_push_token,
          sound: 'default',
          title: 'Tugas Pengantaran Baru',
          body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${deliveryOrder.do_number}. Silakan cek detail pengantaran di aplikasi.`,
          data: { do_number: deliveryOrder.do_number }
        }];
        await expo.sendPushNotificationsAsync(messages);
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Delivery order created successfully',
      data: deliveryOrder
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating delivery order:', err);
    next(err);
  }
};

// Get all DOs with enhanced web features
exports.getAllDeliveryOrders = async (req, res, next) => {
  try {
    const { status, driver_id, vehicle_id, page = 1, limit = 10, search, po_id } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (driver_id) {
      whereClause.driver_id = driver_id;
    }
    
    if (vehicle_id) {
      whereClause.vehicle_id = vehicle_id;
    }

    if (po_id) {
      whereClause.purchase_order_id = po_id;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { do_number: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: deliveryOrders } = await DeliveryOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          attributes: ['po_number', 'customer_name', 'total_quantity']
        },
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'username'],
          include: [
            {
              model: DriverProfile,
              as: 'driverProfile',
              attributes: ['full_name', 'phone']
            }
          ]
        },
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['license_plate', 'type', 'capacity']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Enhance data with computed fields
    const enhancedDOs = deliveryOrders.map(dOrder => {
      const doData = dOrder.toJSON();
      return {
        ...doData,
        status_text: dOrder.getStatusText(),
        financial_summary: dOrder.getFinancialSummary(),
        driver_name: doData.driver?.driverProfile?.full_name || doData.driver?.username || 'N/A',
        vehicle_info: `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || 'N/A'
      };
    });

    // Calculate summary stats
    const stats = {
      total: count,
      assigned: enhancedDOs.filter(d => d.status === 'assigned').length,
      in_progress: enhancedDOs.filter(d => ['otw_to_load_location', 'at_load_location', 'otw_to_unload_location', 'at_unload_location', 'otw_to_base'].includes(d.status)).length,
      completed: enhancedDOs.filter(d => d.status === 'completed').length,
      cancelled: enhancedDOs.filter(d => d.status === 'cancelled').length,
      total_revenue: enhancedDOs.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0),
      total_ongkosan: enhancedDOs.reduce((sum, d) => sum + (parseFloat(d.ongkosan) || 0), 0),
      total_driver_costs: enhancedDOs.reduce((sum, d) => sum + (parseFloat(d.trip_allowance) || 0) + (parseFloat(d.gaji) || 0), 0)
    };

    res.json({
      success: true,
      data: enhancedDOs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      },
      stats
    });
  } catch (err) {
    next(err);
  }
};

// Get DO by ID with detailed info
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: 'purchaseOrder'
        },
        {
          model: User,
          as: 'driver',
          include: [
            {
              model: DriverProfile,
              as: 'driverProfile'
            }
          ]
        },
        {
          model: Vehicle,
          as: 'vehicle'
        }
      ]
    });

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: 'Delivery Order not found'
      });
    }

    const doData = deliveryOrder.toJSON();
    
    res.json({
      success: true,
      data: {
        ...doData,
        status_text: deliveryOrder.getStatusText(),
        financial_summary: deliveryOrder.getFinancialSummary(),
        timeline: {
          created_at: doData.created_at,
          departed_to_load_location_at: doData.departed_to_load_location_at,
          arrived_at_load_location_at: doData.arrived_at_load_location_at,
          departed_from_load_location_at: doData.departed_from_load_location_at,
          arrived_at_unload_location_at: doData.arrived_at_unload_location_at,
          departed_from_unload_location_at: doData.departed_from_unload_location_at,
          completed_at: doData.completed_at
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// Update DO (admin only)
exports.updateDeliveryOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deliveryOrder = await DeliveryOrder.findByPk(id);
    
    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: 'Delivery Order not found'
      });
    }

    const updatedDO = await deliveryOrder.update(req.body);
    
    res.json({
      success: true,
      message: 'Delivery Order updated successfully',
      data: updatedDO
    });
  } catch (err) {
    next(err);
  }
};

// Cancel DO
exports.cancelDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;
    
    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });
    
    if (!deliveryOrder) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Delivery Order not found'
      });
    }

    // Update delivery order status
    await deliveryOrder.update({
      status: 'cancelled',
      notes: cancellation_reason || 'Cancelled by admin'
    }, { transaction });

    // Free up vehicle and driver
    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: 'available' },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Delivery Order cancelled successfully'
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// Get delivery statistics
exports.getDeliveryStatistics = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { created_at: { [Op.gte]: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { created_at: { [Op.gte]: monthAgo } };
    } else if (period === 'year') {
      const yearAgo = new Date(now.getFullYear(), 0, 1);
      dateFilter = { created_at: { [Op.gte]: yearAgo } };
    }

    const [
      totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      totalRevenue,
      totalOngkosan,
      totalDriverCosts
    ] = await Promise.all([
      DeliveryOrder.count({ where: dateFilter }),
      DeliveryOrder.count({ where: { ...dateFilter, status: 'completed' } }),
      DeliveryOrder.count({ where: { ...dateFilter, status: 'cancelled' } }),
      DeliveryOrder.sum('total_amount', { where: { ...dateFilter, status: 'completed' } }) || 0,
      DeliveryOrder.sum('ongkosan', { where: { ...dateFilter, status: 'completed' } }) || 0,
      DeliveryOrder.sum('trip_allowance', { where: { ...dateFilter, status: 'completed' } }) || 0 +
      DeliveryOrder.sum('gaji', { where: { ...dateFilter, status: 'completed' } }) || 0
    ]);

    const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const netProfit = parseFloat(totalOngkosan) - parseFloat(totalDriverCosts);

    res.json({
      success: true,
      data: {
        period,
        total_deliveries: totalDeliveries,
        completed_deliveries: completedDeliveries,
        cancelled_deliveries: cancelledDeliveries,
        completion_rate: Math.round(completionRate * 100) / 100,
        total_revenue: parseFloat(totalRevenue),
        total_ongkosan: parseFloat(totalOngkosan),
        total_driver_costs: parseFloat(totalDriverCosts),
        net_profit: netProfit
      }
    });
  } catch (err) {
    next(err);
  }
};
