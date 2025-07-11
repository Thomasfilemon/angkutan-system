// src/controllers/web/stockController.js
const db = require('../../models');
const { StockItem, StockCategory, StockTransaction, ServiceItem, StockBatch, sequelize } = db;
const { Op } = require('sequelize');

// Get all stock items
const getAllStockItems = async (req, res, next) => {
    try {
        const { category_id, low_stock, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = {};
        if (category_id) whereClause.category_id = category_id;
        if (search) {
            whereClause[Op.or] = [
                { item_name: { [Op.iLike]: `%${search}%` } },
                { item_code: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const result = await StockItem.findAndCountAll({
            where: whereClause,
            include: [
                { model: StockCategory, as: 'category' },
                { 
                    model: StockBatch, 
                    as: 'batches',
                    where: { remaining_quantity: { [Op.gt]: 0 } },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // Calculate weighted average prices
        const enhancedItems = await Promise.all(result.rows.map(async (item) => {
            const batches = await StockBatch.findAll({
                where: { 
                    item_id: item.id,
                    remaining_quantity: { [Op.gt]: 0 }
                }
            });

            let totalValue = 0;
            let totalQuantity = 0;
            
            batches.forEach(batch => {
                const qty = parseFloat(batch.remaining_quantity);
                const price = parseFloat(batch.purchase_price);
                totalValue += qty * price;
                totalQuantity += qty;
            });

            const weightedAveragePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

            return {
                ...item.toJSON(),
                weighted_average_price: weightedAveragePrice,
                total_value: totalValue,
                batch_count: batches.length,
                is_low_stock: parseFloat(item.current_stock) <= parseFloat(item.min_stock),
                stock_status: parseFloat(item.current_stock) <= 0 ? 'out_of_stock' :
                           parseFloat(item.current_stock) <= parseFloat(item.min_stock) ? 'low_stock' : 'adequate',
                unit_price: weightedAveragePrice // Use weighted average as unit_price

            };
        }));

        res.json({
            data: enhancedItems,
            pagination: {
                totalItems: result.count,
                totalPages: Math.ceil(result.count / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (err) {
        console.error('Error in getAllStockItems:', err);
        next(err);
    }
};

// Create new stock item
const createStockItem = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { 
            category_id, item_code, item_name, supplier, unit, 
            current_stock, min_stock, unit_price, notes 
        } = req.body;

        // Create stock item
        const stockItem = await StockItem.create({
            category_id, item_code, item_name, supplier, unit,
            current_stock: current_stock || 0,
            min_stock: min_stock || 0,
            notes
        }, { transaction: t });

        // Create initial batch if stock > 0
        if (current_stock > 0 && unit_price > 0) {
            const batchNumber = `BATCH-${item_code || stockItem.id}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            
            await StockBatch.create({
                item_id: stockItem.id,
                batch_number: batchNumber,
                purchase_price: unit_price,
                initial_quantity: current_stock,
                remaining_quantity: current_stock,
                purchase_date: new Date(),
                supplier,
                notes: 'Initial stock batch'
            }, { transaction: t });

            // Record transaction
            await StockTransaction.create({
                item_id: stockItem.id,
                transaction_type: 'in',
                quantity: current_stock,
                unit_price,
                total_amount: current_stock * unit_price,
                reference_type: 'initial_stock',
                notes: 'Initial stock entry'
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({
            success: true,
            message: 'Stock item created successfully',
            data: stockItem
        });
    } catch (err) {
        await t.rollback();
        console.error('Error in createStockItem:', err);
        next(err);
    }
};

// Get stock item by ID
// In src/controllers/web/stockController.js
const getStockItemById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const stockItem = await StockItem.findByPk(id, {
            include: [
                { model: StockCategory, as: 'category' },
                { 
                    model: StockBatch, 
                    as: 'batches',
                    where: { remaining_quantity: { [Op.gt]: 0 } },
                    required: false,
                    order: [['purchase_date', 'ASC']]
                }
            ]
        });

        if (!stockItem) {
            return res.status(404).json({
                success: false,
                message: 'Stock item not found'
            });
        }

        // Calculate weighted average price
        const batches = await StockBatch.findAll({
            where: { 
                item_id: id,
                remaining_quantity: { [Op.gt]: 0 }
            }
        });

        let totalValue = 0;
        let totalQuantity = 0;
        
        batches.forEach(batch => {
            const qty = parseFloat(batch.remaining_quantity);
            const price = parseFloat(batch.purchase_price);
            totalValue += qty * price;
            totalQuantity += qty;
        });

        const weightedAveragePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

        res.json({
            success: true,
            data: {
                ...stockItem.toJSON(),
                weighted_average_price: weightedAveragePrice,
                total_value: totalValue,
                is_low_stock: parseFloat(stockItem.current_stock) <= parseFloat(stockItem.min_stock)
            }
        });
    } catch (err) {
        console.error('Error in getStockItemById:', err);
        next(err);
    }
};

// Get batch details for an item
const getStockBatches = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const batches = await StockBatch.findAll({
            where: { item_id: id },
            order: [['purchase_date', 'ASC']]
        });

        res.json({
            success: true,
            data: batches
        });
    } catch (err) {
        console.error('Error in getStockBatches:', err);
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
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { quantity, unit_price, supplier, notes } = req.body;

        if (!quantity || parseFloat(quantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be greater than 0'
            });
        }

        const stockItem = await StockItem.findByPk(id, { transaction: t });
        if (!stockItem) {
            return res.status(404).json({
                success: false,
                message: 'Stock item not found'
            });
        }

        // Create new batch
        const batchNumber = `BATCH-${stockItem.item_code || id}-${Date.now()}`;
        const batch = await StockBatch.create({
            item_id: id,
            batch_number: batchNumber,
            purchase_price: unit_price,
            initial_quantity: quantity,
            remaining_quantity: quantity,
            purchase_date: new Date(),
            supplier,
            notes
        }, { transaction: t });

        // Update stock item total
        const newStock = parseFloat(stockItem.current_stock) + parseFloat(quantity);
        await stockItem.update({ current_stock: newStock }, { transaction: t });

        // Record transaction
        await StockTransaction.create({
            item_id: id,
            batch_id: batch.id,
            transaction_type: 'in',
            quantity: parseFloat(quantity),
            unit_price: parseFloat(unit_price),
            total_amount: parseFloat(quantity) * parseFloat(unit_price),
            reference_type: 'restock',
            supplier,
            notes
        }, { transaction: t });

        await t.commit();
        res.json({
            success: true,
            message: 'Stock added successfully',
            data: { stockItem, batch }
        });
    } catch (err) {
        await t.rollback();
        console.error('Error in addStock:', err);
        next(err);
    }
};

// FIFO stock consumption
const consumeStock = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { item_id, quantity, reference_type, reference_id, notes } = req.body;

        if (!quantity || parseFloat(quantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be greater than 0'
            });
        }

        const stockItem = await StockItem.findByPk(item_id, { transaction: t });
        if (!stockItem) {
            return res.status(404).json({
                success: false,
                message: 'Stock item not found'
            });
        }

        if (parseFloat(stockItem.current_stock) < parseFloat(quantity)) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock available'
            });
        }

        // Get batches ordered by purchase date (FIFO)
        const batches = await StockBatch.findAll({
            where: { 
                item_id,
                remaining_quantity: { [Op.gt]: 0 }
            },
            order: [['purchase_date', 'ASC']],
            transaction: t
        });

        let remainingToConsume = parseFloat(quantity);
        let totalCost = 0;
        const consumedBatches = [];

        // Consume from batches using FIFO
        for (const batch of batches) {
            if (remainingToConsume <= 0) break;

            const batchAvailable = parseFloat(batch.remaining_quantity);
            const consumeFromBatch = Math.min(remainingToConsume, batchAvailable);
            
            // Update batch remaining quantity
            await batch.update({
                remaining_quantity: batchAvailable - consumeFromBatch
            }, { transaction: t });

            // Record transaction for this batch
            await StockTransaction.create({
                item_id,
                batch_id: batch.id,
                transaction_type: 'out',
                quantity: -consumeFromBatch,
                unit_price: batch.purchase_price,
                total_amount: -consumeFromBatch * batch.purchase_price,
                reference_type,
                reference_id,
                notes: `${notes} - Consumed from ${batch.batch_number}`
            }, { transaction: t });

            totalCost += consumeFromBatch * batch.purchase_price;
            consumedBatches.push({
                batch_number: batch.batch_number,
                quantity: consumeFromBatch,
                price: batch.purchase_price,
                cost: consumeFromBatch * batch.purchase_price
            });

            remainingToConsume -= consumeFromBatch;
        }

        // Update stock item total
        const newStock = parseFloat(stockItem.current_stock) - parseFloat(quantity);
        await stockItem.update({ current_stock: newStock }, { transaction: t });

        await t.commit();
        res.json({
            success: true,
            message: 'Stock consumed successfully using FIFO',
            data: {
                consumed_quantity: quantity,
                total_cost: totalCost,
                average_cost: totalCost / quantity,
                consumed_batches: consumedBatches,
                remaining_stock: newStock
            }
        });
    } catch (err) {
        await t.rollback();
        console.error('Error in consumeStock:', err);
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

const adjustStock = async (req, res) => {
  const { itemId, quantity, notes } = req.body;

  if (!itemId || quantity === undefined) {
    return res.status(400).json({ message: 'Item ID dan kuantitas diperlukan.' });
  }

  const t = await sequelize.transaction();

  try {
    const item = await StockItem.findByPk(itemId, { transaction: t });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: 'Item stok tidak ditemukan.' });
    }

    // Buat transaksi stok dengan tipe 'adjustment'
    await StockTransaction.create({
      item_id: itemId,
      transaction_type: 'adjustment',
      quantity: quantity, // quantity bisa positif (menambah) atau negatif (mengurangi)
      notes: notes,
      // unit_price dan total_amount bisa dikosongkan untuk adjustment
    }, { transaction: t });

    // Update kuantitas saat ini di tabel stock_items
    const newStock = parseFloat(item.current_stock) + parseFloat(quantity);
    item.current_stock = newStock;
    await item.save({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Stok berhasil disesuaikan.', data: item });

  } catch (error) {
    await t.rollback();
    console.error('Error saat penyesuaian stok:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: error.message });
  }
};

const getStockItemHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Ambil parameter query untuk filter dan pagination
    const { search, page = 1, limit = 10, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {
      item_id: id, // Tetap filter berdasarkan ID item
    };

    // Tambahkan filter pencarian di kolom 'notes'
    if (search) {
      whereClause.notes = { [Op.iLike]: `%${search}%` };
    }

    // Tambahkan filter rentang tanggal
    if (startDate && endDate) {
      whereClause.transaction_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const result = await StockTransaction.findAndCountAll({
      where: whereClause,
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
    });

    res.status(200).json({
      data: result.rows,
      pagination: {
        totalItems: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    next(error);
  }
};

// Update your module.exports to include the delete function
module.exports = {
  getAllStockItems,
  createStockItem,
  getStockItemById,
  updateStockItem,
  consumeStock,
  getStockBatches,
  addStock,
  deleteStockItem, // Add this line
  getStockCategories,
  adjustStock,
  getStockItemHistory // <-- Pastikan fungsi baru diekspor
};
