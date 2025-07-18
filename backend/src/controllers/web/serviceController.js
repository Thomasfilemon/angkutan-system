// src/controllers/web/serviceController.js
const db = require('../../models');
const {  
  ServiceItem, 
  Vehicle,
  VehicleService, 
  StockItem, 
  StockTransaction, 
  StockBatch,
  StockCategory,
  CashTransaction,
  CashCategory, // ✅ ADD: Import CashCategory for proper kas integration
  sequelize
} = db;
const { Op } = require('sequelize');

// ===============================
// HELPER FUNCTIONS
// ===============================

// Calculate current stock from FIFO batches
const calculateCurrentStock = async (itemId) => {
  try {
    const result = await StockBatch.findOne({
      where: { item_id: itemId },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
      ]
    });
    
    return parseFloat(result?.dataValues?.total_quantity) || 0;
  } catch (error) {
    console.error('Error calculating current stock:', error);
    return 0;
  }
};

// Calculate stock item averages and totals
const calculateStockItemAverages = async (itemId) => {
  try {
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
  } catch (error) {
    console.error('Error calculating stock averages:', error);
    return { totalQuantity: 0, totalValue: 0, averagePrice: 0 };
  }
};

// FIFO stock deduction with proper transaction handling
const deductStockFIFO = async (itemId, quantity, serviceId, transaction) => {
  let remainingToDeduct = parseFloat(quantity);
  
  const batches = await StockBatch.findAll({
    where: {
      item_id: itemId,
      quantity: { [Op.gt]: 0 }
    },
    order: [['purchase_date', 'ASC'], ['created_at', 'ASC']],
    transaction
  });

  const totalAvailable = batches.reduce((sum, batch) => sum + parseFloat(batch.quantity), 0);
  
  if (remainingToDeduct > totalAvailable) {
    throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${remainingToDeduct}`);
  }

  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;

    const batchQuantity = parseFloat(batch.quantity);
    const deductFromBatch = Math.min(remainingToDeduct, batchQuantity);

    await batch.update({
      quantity: batchQuantity - deductFromBatch
    }, { transaction });

    await StockTransaction.create({
      item_id: itemId,
      batch_id: batch.id,
      transaction_type: 'out',
      quantity: deductFromBatch,
      unit_price: batch.unit_price,
      total_amount: deductFromBatch * batch.unit_price,
      reference_type: 'service',
      reference_id: serviceId,  // ✅ FIXED: Pass service ID (integer) instead of service number (string)
      notes: `Used in service ID ${serviceId} from batch ${batch.batch_number}`
    }, { transaction });

    remainingToDeduct -= deductFromBatch;
  }
};
// Generate unique service number
const generateServiceNumber = async (transaction) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const lastService = await VehicleService.findOne({
    where: {
      service_number: { [Op.like]: `SRV-${today}-%` }
    },
    order: [["service_number", "DESC"]],
    transaction
  });

  let sequence = 1;
  if (lastService) {
    const lastSequence = parseInt(lastService.service_number.split("-").pop()) || 0;
    sequence = lastSequence + 1;
  }
  
  return `SRV-${today}-${sequence.toString().padStart(3, "0")}`;
};

// ===============================
// MAIN CONTROLLER FUNCTIONS
// ===============================

// Get all services with pagination and filtering
const getAllServices = async (req, res, next) => {
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
    console.error('Error in getAllServices:', err);
    next(err);
  }
};

// Get service by ID with complete details
const getServiceById = async (req, res, next) => {
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

    // Ensure all numeric fields are properly formatted
    const serviceData = service.toJSON();
    serviceData.labor_cost = parseFloat(serviceData.labor_cost) || 0;
    serviceData.parts_cost = parseFloat(serviceData.parts_cost) || 0;
    serviceData.total_cost = serviceData.labor_cost + serviceData.parts_cost;
    
    // Clean and validate service items
    serviceData.serviceItems = (serviceData.serviceItems || [])
      .filter(item => item != null)
      .map(item => ({
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
    console.error('Error in getServiceById:', err);
    next(err);
  }
};

// ✅ UPDATED: Create new service with FIFO integration
// ✅ UPDATED: Create new service with multiple attachments support
exports.createService = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  let serviceId;

  try {
    // Validate request body
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
    const serviceItems = req.body.items ? JSON.parse(req.body.items) : [];
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

    // Generate service number
    const serviceNumber = await generateServiceNumber(transaction);

    // Validate stock availability for items from stock
    for (const item of serviceItems) {
      if (item.from_stock && item.stock_item_id) {
        const currentStock = await calculateCurrentStock(item.stock_item_id);
        if (parseFloat(item.quantity) > currentStock) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.item_name}. Available: ${currentStock}, Requested: ${item.quantity}`
          });
        }
      }
    }

    // Calculate costs
    const laborCostAmount = parseFloat(labor_cost) || 0;
    let totalPartsCost = 0;

    // Process service items and calculate total parts cost
    for (const item of serviceItems) {
      totalPartsCost += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    }

    // Create service record
    const service = await VehicleService.create({
      service_number: serviceNumber,
      vehicle_id: parseInt(vehicle_id),
      service_date: service_date || new Date(),
      service_type: service_type || 'regular',
      description: description.trim(),
      workshop_name: workshop_name || '',
      labor_cost: laborCostAmount,
      parts_cost: totalPartsCost,
      notes: notes || '',
      status: 'completed'
    }, { transaction });

    // Create service items and deduct stock
    for (const item of serviceItems) {
      await ServiceItem.create({
        service_id: service.id,
        stock_item_id: item.stock_item_id || null,
        item_name: item.item_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        from_stock: item.from_stock || false
      }, { transaction });

      // Deduct from stock using FIFO if item is from stock
      if (item.from_stock && item.stock_item_id) {
        await deductStockFIFO(
          item.stock_item_id,
          item.quantity,
          service.id,
          transaction
        );
      }
    }

    // ✅ FIXED: Create kas transaction even for zero-price items
    if (cashSettings.save_to_cash) {
      const totalServiceCost = laborCostAmount + totalPartsCost;
      
      // Create kas transaction if there are ANY service items OR labor cost > 0
      if (totalServiceCost > 0 || serviceItems.length > 0) {
        const transactionType = cashSettings.is_tempo ? "debit_tempo" : "debit";
        
        // Enhanced description with item details
        let description_parts = [`Service ${serviceNumber} - Vehicle ${vehicle_id}`];
        if (laborCostAmount > 0) {
          description_parts.push(`Labor: Rp ${laborCostAmount.toLocaleString('id-ID')}`);
        }
        if (totalPartsCost > 0) {
          description_parts.push(`Parts: Rp ${totalPartsCost.toLocaleString('id-ID')}`);
        }
        if (serviceItems.length > 0) {
          description_parts.push(`Items used: ${serviceItems.length} items`);
          
          // Add zero-price items to description for tracking
          const zeroPriceItems = serviceItems.filter(item => parseFloat(item.unit_price) === 0);
          if (zeroPriceItems.length > 0) {
            description_parts.push(`Zero-price items: ${zeroPriceItems.map(item => `${item.item_name} (${item.quantity})`).join(', ')}`);
          }
        }

        const kasDescription = description_parts.join('\n');

        // Find or create appropriate cash category
        let cashCategory = await CashCategory.findOne({
          where: { category_name: 'Biaya Operasional', category_type: 'expense' },
          transaction
        });

        if (!cashCategory) {
          cashCategory = await CashCategory.create({
            category_name: 'Biaya Operasional',
            category_type: 'expense',
            description: 'Biaya operasional kendaraan dan maintenance'
          }, { transaction });
        }

        // Create cash transaction data
        const cashTransactionData = {
          transaction_type: transactionType,
          category_id: cashCategory.id,
          amount: Math.max(totalServiceCost, 0.01), // Minimum 0.01 for tracking even zero-cost services
          description: kasDescription,
          reference_number: serviceNumber,
          account: cashSettings.account || 'General',
          transaction_date: service_date
        };

        // Handle file attachment if present
        if (req.file) {
          cashTransactionData.attachment_url = req.file.path;
        }

        await CashTransaction.create(cashTransactionData, { transaction });
      }
    }

    await transaction.commit();

    // Fetch complete service data for response
    const completeService = await VehicleService.findByPk(service.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { 
          model: ServiceItem, 
          as: 'serviceItems',
          include: [{ model: StockItem, as: 'stockItem', required: false }]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: completeService
    });

  } catch (err) {
    await transaction.rollback();
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
      message: err.message || 'Service creation failed'
    });
  }
};

// Update service (basic info only, not items)
const updateService = async (req, res, next) => {
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
    console.error('Error in updateService:', err);
    next(err);
  }
};

// Cancel service with proper stock restoration
const cancelService = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
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

    // Restore stock for items that were from stock
    for (const item of service.serviceItems) {
      if (item.from_stock && item.stock_item_id) {
        // Use the stock adjustment logic to restore stock
        const stockController = require('./stockController');
        
        const mockReq = {
          body: {
            itemId: item.stock_item_id,
            adjustmentType: 'add',
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
            notes: `Restored from cancelled service ${service.service_number || service.id}`,
            create_new_batch: false
          }
        };

        const mockRes = {
          json: () => {},
          status: () => ({ json: () => {} })
        };

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

// Get available stock items with current FIFO-calculated stock
const getAvailableStockItems = async (req, res, next) => {
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

    // Calculate current stock from batches for each item
    const enhancedItems = await Promise.all(stockItems.map(async (item) => {
      const itemData = item.toJSON();
      const currentStock = await calculateCurrentStock(item.id);
      const { totalValue, averagePrice } = await calculateStockItemAverages(item.id);
      
      return {
        ...itemData,
        current_stock: currentStock,
        unit_price: averagePrice, // Use weighted average price
        total_value: totalValue,
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

// Get detailed stock item information for service selection
const getStockItemDetails = async (req, res, next) => {
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

// ===============================
// EXPORTS
// ===============================

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  cancelService,
  getAvailableStockItems,
  getStockItemDetails
};
