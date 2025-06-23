// src/controllers/web/serviceController.js
const { VehicleService, ServiceItem, Vehicle, StockItem, StockTransaction } = require('../../models');
const { Op } = require('sequelize');

// Get all services
exports.getAllServices = async (req, res, next) => {
  try {
    const { vehicle_id, service_type, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (vehicle_id) whereClause.vehicle_id = vehicle_id;
    if (service_type) whereClause.service_type = service_type;
    if (status) whereClause.status = status;

    const result = await VehicleService.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['license_plate', 'type']
        },
        {
          model: ServiceItem,
          as: 'serviceItems',
          include: [{
            model: StockItem,
            as: 'stockItem',
            required: false
          }]
        }
      ],
      order: [['service_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get service by ID
exports.getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const service = await VehicleService.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['license_plate', 'type', 'capacity']
        },
        {
          model: ServiceItem,
          as: 'serviceItems',
          include: [{
            model: StockItem,
            as: 'stockItem',
            required: false
          }]
        }
      ]
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// Create new service
exports.createService = async (req, res, next) => {
  try {
    const { vehicle_id, service_date, service_type, description, workshop_name, labor_cost, items = [], notes } = req.body;
    
    // Calculate parts cost from items
    const parts_cost = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    // Create service
    const service = await VehicleService.create({
      vehicle_id,
      service_date,
      service_type,
      description,
      workshop_name,
      labor_cost: labor_cost || 0,
      parts_cost,
      notes
    });

    // Create service items and update stock if needed
    for (const item of items) {
      await ServiceItem.create({
        service_id: service.id,
        stock_item_id: item.stock_item_id || null,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        from_stock: item.from_stock || false
      });

      // If item is from stock, reduce stock quantity
      if (item.from_stock && item.stock_item_id) {
        const stockItem = await StockItem.findByPk(item.stock_item_id);
        if (stockItem) {
          const newStock = parseFloat(stockItem.current_stock) - parseFloat(item.quantity);
          await stockItem.update({ current_stock: Math.max(0, newStock) });

          // Record stock transaction
          await StockTransaction.create({
            item_id: item.stock_item_id,
            transaction_type: 'out',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.quantity * item.unit_price,
            reference_type: 'service',
            reference_id: service.id,
            notes: `Used in service ${service.service_number}`
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// Update service
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await VehicleService.findByPk(id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (service.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update cancelled service'
      });
    }

    await service.update(req.body);

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// Cancel service
exports.cancelService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await VehicleService.findByPk(id, {
      include: [{
        model: ServiceItem,
        as: 'serviceItems',
        where: { from_stock: true },
        required: false
      }]
    });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (service.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Service is already cancelled'
      });
    }

    // Restore stock for items taken from stock
    for (const item of service.serviceItems) {
      if (item.from_stock && item.stock_item_id) {
        const stockItem = await StockItem.findByPk(item.stock_item_id);
        if (stockItem) {
          const newStock = parseFloat(stockItem.current_stock) + parseFloat(item.quantity);
          await stockItem.update({ current_stock: newStock });

          // Record reverse stock transaction
          await StockTransaction.create({
            item_id: item.stock_item_id,
            transaction_type: 'in',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.quantity * item.unit_price,
            reference_type: 'service_cancel',
            reference_id: service.id,
            notes: `Restored from cancelled service ${service.service_number}`
          });
        }
      }
    }

    await service.update({ status: 'cancelled' });

    res.json({
      success: true,
      message: 'Service cancelled successfully',
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// Get available stock items for service
exports.getAvailableStockItems = async (req, res, next) => {
  try {
    const stockItems = await StockItem.findAll({
      where: {
        current_stock: { [Op.gt]: 0 }
      },
      include: [{
        model: StockCategory,
        as: 'category',
        required: false
      }],
      order: [['item_name', 'ASC']]
    });

    res.json({
      success: true,
      data: stockItems
    });
  } catch (err) {
    next(err);
  }
};
