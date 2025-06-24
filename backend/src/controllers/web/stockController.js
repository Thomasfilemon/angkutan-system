// src/controllers/web/stockController.js
const db = require('../../models');
const { StockItem, StockCategory, StockTransaction } = db;
const { Op } = require('sequelize');

// Get all stock items
const getAllStockItems = async (req, res, next) => {
  try {
    const { category_id, low_stock, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (category_id) {
      whereClause.category_id = category_id;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { item_code: { [Op.iLike]: `%${search}%` } },
        { supplier: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (low_stock === 'true') {
      whereClause[Op.and] = [
        whereClause,
        { current_stock: { [Op.lte]: { [Op.col]: 'min_stock' } } }
      ];
    }

    const result = await StockItem.findAndCountAll({
      where: whereClause,
      include: [{
        model: StockCategory,
        as: 'category',
        required: false
      }],
      order: [['item_name', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Enhance with computed data
    const enhancedItems = result.rows.map(item => {
      const itemData = item.toJSON();
      return {
        ...itemData,
        is_low_stock: parseFloat(item.current_stock) <= parseFloat(item.min_stock),
        total_value: parseFloat(item.current_stock) * parseFloat(item.unit_price),
        stock_status: parseFloat(item.current_stock) <= 0 ? 'out_of_stock' : 
                     parseFloat(item.current_stock) <= parseFloat(item.min_stock) ? 'low_stock' : 'adequate'
      };
    });

    res.json({
      success: true,
      data: enhancedItems,
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (err) {
    console.error('Error in getAllStockItems:', err);
    next(err);
  }
};

// Create new stock item
const createStockItem = async (req, res, next) => {
  try {
    const stockItem = await StockItem.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Stock item created successfully',
      data: stockItem
    });
  } catch (err) {
    console.error('Error in createStockItem:', err);
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    next(err);
  }
};

// Get stock item by ID
// In src/controllers/web/stockController.js
const getStockItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Add validation to ensure id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock item ID. Must be a number.'
      });
    }
    
    const stockItem = await StockItem.findByPk(parseInt(id), {
      include: [{
        model: StockCategory,
        as: 'category',
        required: false
      }]
    });

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...stockItem.toJSON(),
        is_low_stock: parseFloat(stockItem.current_stock) <= parseFloat(stockItem.min_stock),
        total_value: parseFloat(stockItem.current_stock) * parseFloat(stockItem.unit_price)
      }
    });
  } catch (err) {
    console.error('Error in getStockItemById:', err);
    next(err);
  }
};


// Update stock item
const updateStockItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const stockItem = await StockItem.findByPk(id);
    
    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    await stockItem.update(req.body);

    res.json({
      success: true,
      message: 'Stock item updated successfully',
      data: stockItem
    });
  } catch (err) {
    console.error('Error in updateStockItem:', err);
    next(err);
  }
};

// Add stock (restock)
const addStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, unit_price, supplier, notes } = req.body;
    
    if (!quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    const stockItem = await StockItem.findByPk(id);
    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    // Update stock quantity
    const newStock = parseFloat(stockItem.current_stock) + parseFloat(quantity);
    const newUnitPrice = unit_price ? parseFloat(unit_price) : parseFloat(stockItem.unit_price);
    
    await stockItem.update({ 
      current_stock: newStock,
      unit_price: newUnitPrice
    });

    // Record transaction
    await StockTransaction.create({
      item_id: id,
      transaction_type: 'in',
      quantity: parseFloat(quantity),
      unit_price: newUnitPrice,
      total_amount: parseFloat(quantity) * newUnitPrice,
      reference_type: 'restock',
      supplier: supplier,
      notes: notes
    });

    res.json({
      success: true,
      message: 'Stock added successfully',
      data: stockItem
    });
  } catch (err) {
    console.error('Error in addStock:', err);
    next(err);
  }
};

// Get stock categories
const getStockCategories = async (req, res, next) => {
  try {
    const categories = await StockCategory.findAll({
      order: [['category_name', 'ASC']]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error('Error in getStockCategories:', err);
    next(err);
  }
};

// Export all functions
module.exports = {
  getAllStockItems,
  createStockItem,
  getStockItemById,
  updateStockItem,
  addStock,
  getStockCategories
};

const deleteStockItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Add validation to ensure id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock item ID. Must be a number.'
      });
    }
    
    const stockItem = await StockItem.findByPk(parseInt(id));
    
    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    // Check if item is used in any services
    const { ServiceItem } = require('../../models');
    const usedInServices = await ServiceItem.count({
      where: { stock_item_id: id }
    });

    if (usedInServices > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete stock item. It has been used in ${usedInServices} service(s).`
      });
    }

    // Delete the stock item
    await stockItem.destroy();

    res.json({
      success: true,
      message: 'Stock item deleted successfully'
    });
  } catch (err) {
    console.error('Error in deleteStockItem:', err);
    next(err);
  }
};

// Update your module.exports to include the delete function
module.exports = {
  getAllStockItems,
  createStockItem,
  getStockItemById,
  updateStockItem,
  addStock,
  deleteStockItem, // Add this line
  getStockCategories
};
