// src/controllers/web/serviceController.js
const db = require('../../models');
const {  
  ServiceItem, 
  Vehicle,
  VehicleService, 
  StockItem, 
  StockTransaction, 
  StockBatch, // ✅ ADD: Import StockBatch model
  StockCategory,
  CashTransaction,
  sequelize
} = db;
const { Op } = require('sequelize');

console.log('Available models:', Object.keys(db));
console.log('ServiceItem model:', ServiceItem);

// ✅ NEW: Helper function to calculate current stock from batches
const calculateCurrentStock = async (itemId) => {
  const result = await StockBatch.findOne({
    where: { item_id: itemId },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
    ]
  });
  
  return parseFloat(result?.dataValues?.total_quantity) || 0;
};

// ✅ NEW: FIFO stock deduction function (integrates with stock controller logic)
const deductStockFIFO = async (itemId, quantity, serviceDescription, serviceId, transaction) => {
  let remainingToDeduct = parseFloat(quantity);
  
  // Get all batches ordered by purchase date (FIFO)
  const batches = await StockBatch.findAll({
    where: {
      item_id: itemId,
      quantity: { [Op.gt]: 0 }
    },
    order: [['purchase_date', 'ASC'], ['created_at', 'ASC']],
    transaction
  });

  // Check if we have enough stock
  const totalAvailable = batches.reduce((sum, batch) => sum + parseFloat(batch.quantity), 0);
  if (remainingToDeduct > totalAvailable) {
    throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${remainingToDeduct}`);
  }

  // Deduct from batches using FIFO
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;

    const batchQuantity = parseFloat(batch.quantity);
    const deductFromBatch = Math.min(remainingToDeduct, batchQuantity);

    await batch.update({
      quantity: batchQuantity - deductFromBatch
    }, { transaction });

    // Record transaction for this batch
    await StockTransaction.create({
      item_id: itemId,
      batch_id: batch.id,
      transaction_type: 'out',
      quantity: deductFromBatch,
      unit_price: batch.unit_price,
      total_amount: deductFromBatch * batch.unit_price,
      reference_type: 'service',
      reference_id: serviceId,
      notes: `Used in service: ${serviceDescription} (Batch: ${batch.batch_number})`
    }, { transaction });

    remainingToDeduct -= deductFromBatch;
  }

  // Update stock item averages
  const { totalQuantity, totalValue, averagePrice } = await calculateStockItemAverages(itemId);
  const stockItem = await StockItem.findByPk(itemId, { transaction });
  if (stockItem) {
    await stockItem.update({
      average_unit_price: averagePrice,
      total_value: totalValue,
      updated_at: new Date()
    }, { transaction });
  }
};

// ✅ NEW: Helper function to calculate stock item averages
const calculateStockItemAverages = async (itemId) => {
  const result = await StockBatch.findOne({
    where: { item_id: itemId },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity'],
      [sequelize.fn('SUM', sequelize.literal('quantity * unit_price')), 'total_value']
    ]
  });
  
  const totalQuantity = parseFloat(result?.dataValues?.total_quantity) || 0;
  const totalValue = parseFloat(result?.dataValues?.total_value) || 0;
  const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;
  
  return { totalQuantity, totalValue, averagePrice };
};

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

    // Convert to plain object and ensure all fields exist
    const serviceData = service.toJSON();
    
    // Ensure cost fields are numbers, not null/undefined
    serviceData.labor_cost = parseFloat(serviceData.labor_cost) || 0;
    serviceData.parts_cost = parseFloat(serviceData.parts_cost) || 0;
    serviceData.total_cost = serviceData.labor_cost + serviceData.parts_cost;
    
    // Ensure serviceItems is an array and clean up any null items
    serviceData.serviceItems = (serviceData.serviceItems || []).filter(item => item != null);
    
    // Validate each service item
    serviceData.serviceItems = serviceData.serviceItems.map(item => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      unit_price: parseFloat(item.unit_price) || 0,
      from_stock: Boolean(item.from_stock)
    }));

    res.json({
      success: true,
      data: serviceData
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATED: Create new service with FIFO integration
// ✅ UPDATED: Create new service with multiple attachments support
exports.createService = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  let serviceId;

  try {
    // Add validation for req.body
    if (!req.body) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid request format',
      });
    }

    // Parse FormData fields
    const {
      vehicle_id,
      service_date,
      service_type,
      description,
      workshop_name,
      labor_cost,
      notes,
    } = req.body;

    // Parse JSON strings from FormData
    const items = req.body.items ? JSON.parse(req.body.items) : [];
    const cashSettings = req.body.cash_settings ? JSON.parse(req.body.cash_settings) : {};

    // ✅ UPDATED: Handle multiple file uploads
    const attachment_urls = req.files
      ? req.files.map((file) => `uploads/receipts/${file.filename}`)
      : [];

    // Validation
    if (!vehicle_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required',
      });
    }

    if (!description || description.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Service description is required',
      });
    }

    // Validate stock availability using FIFO logic
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.from_stock && item.stock_item_id) {
          const currentStock = await calculateCurrentStock(item.stock_item_id);
          if (parseFloat(item.quantity) > currentStock) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${item.item_name}. Available: ${currentStock}, Requested: ${item.quantity}`,
            });
          }
        }
      }
    }

    // Calculate parts cost
    let totalItemsCost = 0;
    if (items && items.length > 0) {
      totalItemsCost = items.reduce((sum, item) => {
        return sum + parseFloat(item.quantity) * parseFloat(item.unit_price);
      }, 0);
    }

    // Create VehicleService record
    const service = await VehicleService.create(
      {
        vehicle_id: parseInt(vehicle_id),
        service_date: service_date || new Date(),
        service_type: service_type || 'regular',
        description: description.trim(),
        workshop_name: workshop_name || '',
        labor_cost: parseFloat(labor_cost) || 0,
        parts_cost: totalItemsCost,
        notes: notes || '',
      },
      { transaction }
    );

    serviceId = service.id;

    // Process service items with FIFO deduction
    if (items && items.length > 0) {
      for (const item of items) {
        await ServiceItem.create(
          {
            service_id: service.id,
            stock_item_id: item.stock_item_id || null,
            item_name: item.item_name,
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
            from_stock: item.from_stock || false,
          },
          { transaction }
        );

        if (item.from_stock && item.stock_item_id) {
          await deductStockFIFO(item.stock_item_id, item.quantity, description, service.id, transaction);
        }
      }
    }

    // Create cash transaction if required
    if (cashSettings.save_to_cash) {
      const totalServiceCost = parseFloat(labor_cost || 0) + totalItemsCost;

      if (totalServiceCost > 0) {
        const transactionType = cashSettings.is_tempo ? 'kredit_tempo' : 'kredit';
        const serviceDescription = `Servis ${service_type}: ${description}${
          totalItemsCost > 0 ? ` + Suku cadang: ${totalItemsCost.toLocaleString()}` : ''
        }`;

        await CashTransaction.create(
          {
            transaction_type: transactionType,
            amount: totalServiceCost,
            description: serviceDescription,
            account: cashSettings.account || 'General',
            transaction_date: service_date || new Date(),
            attachment_urls: attachment_urls, // ✅ Store array of URLs
          },
          { transaction }
        );
      }
    }

    // Commit transaction
    await transaction.commit();

    // Fetch complete service data AFTER successful commit
    const completeService = await VehicleService.findByPk(serviceId, {
      include: [{ model: Vehicle, as: 'vehicle' }, { model: ServiceItem, as: 'serviceItems' }],
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: completeService,
    });
  } catch (err) {
    // Only rollback if transaction hasn't been finished
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error in createService:', err);

    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Service creation failed',
    });
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

// ✅ UPDATED: Cancel service with FIFO restoration
exports.cancelService = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  
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
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (service.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Service is already cancelled'
      });
    }

    // ✅ UPDATED: Restore stock using stock adjustment API instead of direct manipulation
    for (const item of service.serviceItems) {
      if (item.from_stock && item.stock_item_id) {
        // Use the existing stock adjustment function from stockController
        const stockController = require('./stockController');
        
        // Create a mock request object for the adjustStock function
        const mockReq = {
          body: {
            itemId: item.stock_item_id,
            adjustmentType: 'add',
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
            notes: `Restored from cancelled service ${service.service_number || service.id}`,
            create_new_batch: false // Add to existing batch with same price
          }
        };

        // Create a mock response object
        const mockRes = {
          json: () => {},
          status: () => ({ json: () => {} })
        };

        // Call the stock adjustment function
        try {
          await stockController.adjustStock(mockReq, mockRes, (err) => {
            if (err) throw err;
          });
        } catch (adjustErr) {
          console.error('Error adjusting stock during service cancellation:', adjustErr);
          // Continue with cancellation even if stock adjustment fails
        }
      }
    }

    await service.update({ status: 'cancelled' }, { transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: 'Service cancelled successfully',
      data: service
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in cancelService:', err);
    next(err);
  }
};

// ✅ UPDATED: Get available stock items using FIFO calculated stock
exports.getAvailableStockItems = async (req, res, next) => {
  try {
    const stockItems = await StockItem.findAll({
      include: [
        {
          model: StockCategory,
          as: 'category',
          required: false
        },
        {
          model: StockBatch,
          as: 'batches',
          where: { quantity: { [Op.gt]: 0 } },
          required: false,
          attributes: ['id', 'quantity', 'unit_price', 'purchase_date']
        }
      ],
      order: [['item_name', 'ASC']]
    });

    // ✅ Calculate current stock from batches for each item
    const enhancedItems = await Promise.all(stockItems.map(async (item) => {
      const itemData = item.toJSON();
      const currentStock = await calculateCurrentStock(item.id);
      
      return {
        ...itemData,
        current_stock: currentStock,
        is_available: currentStock > 0,
        batch_count: itemData.batches ? itemData.batches.length : 0
      };
    }));

    // Filter to only show items with available stock
    const availableItems = enhancedItems.filter(item => item.current_stock > 0);

    res.json({
      success: true,
      data: availableItems
    });
  } catch (err) {
    console.error('Error in getAvailableStockItems:', err);
    next(err);
  }
};

// ✅ NEW: Get stock item details with batches for service selection
exports.getStockItemDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const stockItem = await StockItem.findByPk(id, {
      include: [
        {
          model: StockCategory,
          as: 'category',
          required: false
        },
        {
          model: StockBatch,
          as: 'batches',
          where: { quantity: { [Op.gt]: 0 } },
          required: false,
          order: [['purchase_date', 'ASC'], ['created_at', 'ASC']]
        }
      ]
    });

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    const currentStock = await calculateCurrentStock(id);
    const { totalQuantity, totalValue, averagePrice } = await calculateStockItemAverages(id);

    res.json({
      success: true,
      data: {
        ...stockItem.toJSON(),
        current_stock: currentStock,
        total_value: totalValue,
        average_unit_price: averagePrice,
        is_available: currentStock > 0
      }
    });
  } catch (err) {
    console.error('Error in getStockItemDetails:', err);
    next(err);
  }
};
