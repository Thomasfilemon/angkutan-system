// src/controllers/web/stockController.js
const db = require("../../models");
const {
  StockItem,
  StockCategory,
  StockTransaction,
  StockBatch,
  ServiceItem,
  sequelize,
} = db;
const { Op } = require("sequelize");

// Helper function to generate batch number
const generateBatchNumber = async (itemId, itemCode) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${itemCode || "ITM"}-${today}`;

  const lastBatch = await StockBatch.findOne({
    where: {
      item_id: itemId,
      batch_number: {
        [Op.like]: `${prefix}-%`,
      },
    },
    order: [["batch_number", "DESC"]],
  });

  let sequence = 1;
  if (lastBatch) {
    const lastSequence = parseInt(lastBatch.batch_number.split("-").pop()) || 0;
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
};

// Helper function to calculate current stock from batches
const calculateCurrentStock = async (itemId) => {
  const result = await StockBatch.findOne({
    where: { item_id: itemId },
    attributes: [
      [sequelize.fn("SUM", sequelize.col("quantity")), "total_quantity"],
      [
        sequelize.fn("SUM", sequelize.literal("quantity * unit_price")),
        "total_value",
      ],
    ],
  });

  const totalQuantity = parseFloat(result?.dataValues?.total_quantity) || 0;
  const totalValue = parseFloat(result?.dataValues?.total_value) || 0;
  const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  return { totalQuantity, totalValue, averagePrice };
};

// Get all stock items with calculated current stock
const getAllStockItems = async (req, res, next) => {
  try {
    const {
      category_id,
      low_stock,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (category_id) whereClause.category_id = category_id;
    if (search) {
      whereClause[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { item_code: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const result = await StockItem.findAndCountAll({
      where: whereClause,
      include: [
        { model: StockCategory, as: "category", required: false },
        {
          model: StockBatch,
          as: "batches",
          attributes: [
            "id",
            "batch_number",
            "quantity",
            "unit_price",
            "purchase_date",
          ],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    const enhancedItems = await Promise.all(
      result.rows.map(async (item) => {
        const itemData = item.toJSON();
        itemData.batches = (itemData.batches || []).filter(
          (batch) => batch.quantity > 0
        );
        const { totalQuantity, totalValue, averagePrice } =
          await calculateCurrentStock(item.id);

        return {
          ...itemData,
          current_stock: totalQuantity,
          total_value: totalValue,
          average_unit_price: averagePrice,
          is_low_stock: totalQuantity <= parseFloat(item.min_stock),
          stock_status:
            totalQuantity <= 0
              ? "out_of_stock"
              : totalQuantity <= parseFloat(item.min_stock)
              ? "low_stock"
              : "adequate",
        };
      })
    );

    const filteredItems =
      low_stock === "true"
        ? enhancedItems.filter((item) => item.is_low_stock)
        : enhancedItems;

    res.json({
      data: filteredItems,
      pagination: {
        totalItems: low_stock === "true" ? filteredItems.length : result.count,
        totalPages: Math.ceil(
          (low_stock === "true" ? filteredItems.length : result.count) / limit
        ),
        currentPage: parseInt(page),
      },
    });
  } catch (err) {
    console.error("Error in getAllStockItems:", err);
    next(err);
  }
};

// Create new stock item with initial batch
// Create new stock item with initial batch - FIXED
const createStockItem = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      category_id,
      item_code,
      item_name,
      supplier,
      unit,
      min_stock,
      unit_price,
      initial_stock,
      notes,
    } = req.body;

    const stockItem = await StockItem.create({
      category_id: category_id || null,
      item_code,
      item_name,
      supplier,
      unit: unit || "Pcs",
      min_stock: parseFloat(min_stock) || 0,
      notes,
    }, { transaction });

    if (initial_stock && parseFloat(initial_stock) > 0) {
      const batchNumber = await generateBatchNumber(stockItem.id, item_code);
      const quantity = parseFloat(initial_stock);
      const price = parseFloat(unit_price) || 0;

      // ✅ FIXED: Create batch and capture reference
      const initialBatch = await StockBatch.create({
        item_id: stockItem.id,
        batch_number: batchNumber,
        quantity: quantity,
        original_quantity: quantity,
        unit_price: price,
        supplier,
        notes: "Initial stock batch",
      }, { transaction });

      // ✅ FIXED: Record transaction with proper batch_id
      await StockTransaction.create({
        item_id: stockItem.id,
        batch_id: initialBatch.id, // ← This was missing!
        transaction_type: "in",
        quantity: quantity,
        unit_price: price,
        total_amount: quantity * price,
        reference_type: "initial_stock",
        notes: `Initial stock creation (Batch: ${batchNumber})`,
      }, { transaction });

      await stockItem.update({
        average_unit_price: price,
        total_value: quantity * price,
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Stock item created successfully",
      data: stockItem,
    });

  } catch (err) {
    await transaction.rollback();
    console.error("Error in createStockItem:", err);
    next(err);
  }
};


// Get stock item by ID
const getStockItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock item ID. Must be a number.",
      });
    }

    const stockItem = await StockItem.findByPk(parseInt(id), {
      include: [
        { model: StockCategory, as: "category", required: false },
        {
          model: StockBatch,
          as: "batches",
          where: { quantity: { [Op.gt]: 0 } },
          required: false,
          order: [["purchase_date", "ASC"]],
        },
      ],
    });

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: "Stock item not found",
      });
    }

    const { totalQuantity, totalValue, averagePrice } =
      await calculateCurrentStock(id);

    res.json({
      success: true,
      data: {
        ...stockItem.toJSON(),
        current_stock: totalQuantity,
        total_value: totalValue,
        average_unit_price: averagePrice,
        is_low_stock: totalQuantity <= parseFloat(stockItem.min_stock),
      },
    });
  } catch (err) {
    console.error("Error in getStockItemById:", err);
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
        message: "Stock item not found",
      });
    }

    await stockItem.update(req.body);
    res.json({
      success: true,
      message: "Stock item updated successfully",
      data: stockItem,
    });
  } catch (err) {
    console.error("Error in updateStockItem:", err);
    next(err);
  }
};

// FIFO Stock Adjustment (FIXED with proper batch_id recording)
const adjustStock = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      itemId,
      adjustmentType,
      quantity,
      unit_price,
      supplier,
      notes,
      create_new_batch,
    } = req.body;

    if (!itemId || !adjustmentType || !quantity || parseFloat(quantity) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Item ID, adjustment type, and positive quantity are required",
      });
    }

    const stockItem = await StockItem.findByPk(itemId, { transaction });
    if (!stockItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Stock item not found",
      });
    }

    const adjustmentQuantity = parseFloat(quantity);
    const price = parseFloat(unit_price) || 0;

    if (adjustmentType === "add") {
      let shouldCreateNewBatch = create_new_batch;
      let targetBatch = null;

      if (!shouldCreateNewBatch && price > 0) {
        const existingBatch = await StockBatch.findOne({
          where: {
            item_id: itemId,
            unit_price: price,
          },
          order: [["created_at", "DESC"]],
          transaction,
        });

        shouldCreateNewBatch = !existingBatch;
        targetBatch = existingBatch;
      }

      if (shouldCreateNewBatch) {
        const batchNumber = await generateBatchNumber(
          itemId,
          stockItem.item_code
        );

        // ✅ FIXED: Create new batch and capture the batch reference
        const newBatch = await StockBatch.create({
          item_id: itemId,
          batch_number: batchNumber,
          quantity: adjustmentQuantity,
          original_quantity: adjustmentQuantity,
          unit_price: price,
          supplier,
          notes,
        }, { transaction });

        // ✅ FIXED: Record transaction with proper batch_id
        await StockTransaction.create({
          item_id: itemId,
          batch_id: newBatch.id, // ← This was missing!
          transaction_type: "in",
          quantity: adjustmentQuantity,
          unit_price: price,
          total_amount: adjustmentQuantity * price,
          reference_type: "adjustment",
          notes: notes || `Stock adjustment - increase (New batch: ${batchNumber})`,
        }, { transaction });

      } else {
        // ✅ FIXED: Adding to existing batch
        if (targetBatch) {
          await targetBatch.update({
            quantity: parseFloat(targetBatch.quantity) + adjustmentQuantity,
            original_quantity: parseFloat(targetBatch.original_quantity) + adjustmentQuantity,
          }, { transaction });

          // ✅ FIXED: Record transaction with proper batch_id
          await StockTransaction.create({
            item_id: itemId,
            batch_id: targetBatch.id, // ← This was missing!
            transaction_type: "in",
            quantity: adjustmentQuantity,
            unit_price: price,
            total_amount: adjustmentQuantity * price,
            reference_type: "adjustment",
            notes: notes || `Stock adjustment - increase (Added to batch: ${targetBatch.batch_number})`,
          }, { transaction });
        }
      }

    } else if (adjustmentType === "deduct") {
      let remainingToDeduct = adjustmentQuantity;

      const batches = await StockBatch.findAll({
        where: {
          item_id: itemId,
          quantity: { [Op.gt]: 0 },
        },
        order: [
          ["purchase_date", "ASC"],
          ["created_at", "ASC"],
        ],
        transaction,
      });

      const totalAvailable = batches.reduce(
        (sum, batch) => sum + parseFloat(batch.quantity),
        0
      );

      if (remainingToDeduct > totalAvailable) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${totalAvailable}, Requested: ${remainingToDeduct}`,
        });
      }

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const batchQuantity = parseFloat(batch.quantity);
        const deductFromBatch = Math.min(remainingToDeduct, batchQuantity);

        await batch.update({
          quantity: batchQuantity - deductFromBatch,
        }, { transaction });

        await StockTransaction.create({
          item_id: itemId,
          batch_id: batch.id, // This was already correctly set
          transaction_type: "out",
          quantity: deductFromBatch,
          unit_price: batch.unit_price,
          total_amount: deductFromBatch * batch.unit_price,
          reference_type: "adjustment",
          notes: notes || `Stock adjustment - decrease from batch ${batch.batch_number}`,
        }, { transaction });

        remainingToDeduct -= deductFromBatch;
      }
    }

    // Update stock item averages
    const { totalQuantity, totalValue, averagePrice } = await calculateCurrentStock(itemId);
    await stockItem.update({
      average_unit_price: averagePrice,
      total_value: totalValue,
      updated_at: new Date(),
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        item_id: itemId,
        adjustment_type: adjustmentType,
        quantity: adjustmentQuantity,
        new_total_stock: totalQuantity,
      },
    });

  } catch (err) {
    await transaction.rollback();
    console.error("Error in adjustStock:", err);
    next(err);
  }
};


// Get stock item batches
const getStockBatches = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeEmpty = false } = req.query;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock item ID"
      });
    }

    let whereClause = { item_id: parseInt(id) };
    
    // By default, only show batches with remaining stock
    if (includeEmpty !== 'true') {
      whereClause.quantity = { [Op.gt]: 0 };
    }

    const batches = await StockBatch.findAll({
      where: whereClause,
      order: [
        ["purchase_date", "ASC"],
        ["created_at", "ASC"]
      ]
    });

    // Enhance batch data with calculated fields
    const enhancedBatches = batches.map(batch => {
      const usedQuantity = batch.original_quantity - batch.quantity;
      const usagePercentage = (usedQuantity / batch.original_quantity) * 100;
      
      return {
        ...batch.toJSON(),
        used_quantity: usedQuantity,
        remaining_percentage: (100 - usagePercentage).toFixed(2),
        current_value: batch.quantity * batch.unit_price,
        status: batch.quantity === 0 ? 'exhausted' : 
                batch.quantity === batch.original_quantity ? 'unused' : 'partial'
      };
    });

    res.json({
      success: true,
      data: enhancedBatches
    });
  } catch (err) {
    console.error("Error in getStockBatches:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};
// Delete stock item
const deleteStockItem = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid stock item ID. Must be a number.",
      });
    }

    const stockItem = await StockItem.findByPk(parseInt(id), { transaction });
    if (!stockItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Stock item not found",
      });
    }

    const usedInServices = await ServiceItem.count({
      where: { stock_item_id: id },
    });

    if (usedInServices > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete stock item. It has been used in ${usedInServices} service(s).`,
      });
    }

    await StockBatch.destroy({
      where: { item_id: id },
      transaction,
    });

    await stockItem.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Stock item deleted successfully",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error in deleteStockItem:", err);
    next(err);
  }
};

// Get stock categories
const getStockCategories = async (req, res, next) => {
  try {
    const categories = await StockCategory.findAll({
      order: [["category_name", "ASC"]],
    });
    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error("Error in getStockCategories:", err);
    next(err);
  }
};

// Alternative approach - using correct association alias
const getStockItemHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { search, page = 1, limit = 10, startDate, endDate, batchId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = { item_id: id };

    if (batchId) {
      whereClause.batch_id = batchId;
    }

    if (search) {
      whereClause.notes = { [Op.iLike]: `%${search}%` };
    }

    if (startDate && endDate) {
      whereClause.transaction_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const result = await StockTransaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: StockBatch,
          as: "batch",
          attributes: ["batch_number", "unit_price", "supplier", "purchase_date"],
          required: false
        }
      ],
      order: [
        ["transaction_date", "DESC"],
        ["created_at", "DESC"]
      ],
      limit: parseInt(limit),
      offset: offset
    });

    // ✅ FIXED: Use correct association alias
    let batchInfo = null;
    if (batchId) {
      batchInfo = await StockBatch.findByPk(batchId, {
        include: [
          {
            model: StockItem,
            as: 'stockItem', // ✅ Use the correct alias defined in your association
            attributes: ['item_name', 'item_code', 'unit']
          }
        ]
      });
    }

    res.json({
      success: true,
      data: result.rows,
      batch_info: batchInfo,
      pagination: {
        totalItems: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: parseInt(page)
      }
    });
  } catch (err) {
    console.error("Error in getStockItemHistory:", err);
    next(err);
  }
};


const getStockBatchHistory = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get batch information
    const batchInfo = await StockBatch.findByPk(batchId, {
      include: [
        {
          model: StockItem,
          as: 'item',
          attributes: ['item_name', 'item_code', 'unit']
        }
      ]
    });

    if (!batchInfo) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Get all transactions related to this batch
    const transactions = await StockTransaction.findAndCountAll({
      where: { batch_id: batchId },
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate batch lifecycle metrics
    const usedQuantity = batchInfo.original_quantity - batchInfo.quantity;
    const usagePercentage = (usedQuantity / batchInfo.original_quantity) * 100;

    res.json({
      success: true,
      data: {
        batch: {
          ...batchInfo.toJSON(),
          used_quantity: usedQuantity,
          usage_percentage: usagePercentage.toFixed(2),
          remaining_percentage: (100 - usagePercentage).toFixed(2)
        },
        transactions: transactions.rows,
        lifecycle: {
          initial_quantity: batchInfo.original_quantity,
          current_quantity: batchInfo.quantity,
          used_quantity: usedQuantity,
          total_transactions: transactions.count,
          current_value: batchInfo.quantity * batchInfo.unit_price,
          total_value_used: usedQuantity * batchInfo.unit_price
        }
      },
      pagination: {
        totalItems: transactions.count,
        totalPages: Math.ceil(transactions.count / limit),
        currentPage: parseInt(page),
      }
    });
  } catch (err) {
    console.error('Error in getStockBatchHistory:', err);
    next(err);
  }
};

// Add stock (for compatibility)
const addStock = async (req, res, next) => {
  return adjustStock(req, res, next);
};

module.exports = {
  getAllStockItems,
  createStockItem,
  getStockItemById,
  updateStockItem,
  adjustStock,
  getStockBatchHistory,
  getStockBatches,
  deleteStockItem,
  getStockCategories,
  getStockItemHistory,
  addStock,
};
