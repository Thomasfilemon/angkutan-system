// backend/src/controllers/web/cashController.js
const db = require('../../models');
const { CashTransaction, CashCategory } = db;
const { Op } = require('sequelize');

// Get all cash transactions with summary
exports.getAllCashTransactions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      transaction_type, 
      category_id, 
      date_from, 
      date_to,
      search,
      account
    } = req.query;
    
    const offset = (page - 1) * limit;
    let whereClause = {
      // Exclude tempo transactions
      transaction_type: {
        [Op.in]: ['debit', 'kredit']
      }
    };

    // Filter by transaction type
    if (transaction_type && ['debit', 'kredit'].includes(transaction_type)) {
      whereClause.transaction_type = transaction_type;
    }

    // Filter by category
    if (category_id) {
      whereClause.category_id = category_id;
    }

    // Filter by date range
    if (date_from || date_to) {
      whereClause.transaction_date = {};
      if (date_from) {
        whereClause.transaction_date[Op.gte] = date_from;
      }
      if (date_to) {
        whereClause.transaction_date[Op.lte] = date_to;
      }
    }

    // Search in description or reference number
    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (account && account !== 'All') {
      whereClause.account = account;
    }

    // Get transactions with pagination
    const result = await CashTransaction.findAndCountAll({
      where: whereClause,
      include: [{
        model: CashCategory,
        as: 'category',
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate summary (total debit, kredit, and saldo) - Use all transactions for accurate totals
    const summaryResults = await CashTransaction.findAll({
      where: whereClause, // Use the same whereClause as the main query
      attributes: [
        'transaction_type',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']
      ],
      group: ['transaction_type'],
      raw: true
    });

    const totalDebit = summaryResults.find(s => s.transaction_type === 'debit')?.total || 0;
    const totalKredit = summaryResults.find(s => s.transaction_type === 'kredit')?.total || 0;
    const saldo = parseFloat(totalDebit) - parseFloat(totalKredit);

    // Calculate running balance correctly for ALL transactions first
    const allFilteredTransactions = await CashTransaction.findAll({
      where: whereClause, // Use the same filters
      order: [['created_at', 'ASC']],
      attributes: ['id', 'transaction_type', 'amount', 'created_at']
    });

    // Create balance lookup
    const balanceLookup = {};
    let runningBalance = 0;

    allFilteredTransactions.forEach(transaction => {
      if (transaction.transaction_type === 'debit') {
        runningBalance += parseFloat(transaction.amount);
      } else {
        runningBalance -= parseFloat(transaction.amount);
      }
      balanceLookup[transaction.id] = runningBalance;
    });

    // Add running balance to paginated results
    const enhancedTransactions = result.rows.map(transaction => {
      const transactionData = transaction.toJSON();
      return {
        ...transactionData,
        running_balance: balanceLookup[transaction.id] || 0
      };
    });

    res.json({
      success: true,
      data: enhancedTransactions,
      summary: {
        total_debit: parseFloat(totalDebit),
        total_kredit: parseFloat(totalKredit),
        saldo: saldo
      },
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (err) {
    console.error('Error in getAllCashTransactions:', err);
    next(err);
  }
};

// backend/src/controllers/web/cashController.js
// Add this new function for tempo transactions
exports.getAllTempoTransactions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category_id, 
      date_from, 
      date_to,
      search,
      account
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {
      transaction_type: {
        [Op.in]: ['debit_tempo', 'kredit_tempo']
      }
    };

    // Apply additional filters
    if (category_id) whereClause.category_id = category_id;
    if (date_from || date_to) {
      whereClause.transaction_date = {};
      if (date_from) whereClause.transaction_date[Op.gte] = date_from;
      if (date_to) whereClause.transaction_date[Op.lte] = date_to;
    }
    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (account && account !== 'All') {
      whereClause.account = account;
    }

    // Fetch transactions with pagination
    const result = await CashTransaction.findAndCountAll({
      where: whereClause,
      include: [{
        model: CashCategory,
        as: 'category',
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate summary for tempo transactions
    const summaryResults = await CashTransaction.findAll({
      where: whereClause,
      attributes: [
        'transaction_type',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']
      ],
      group: ['transaction_type'],
      raw: true
    });

    const totalDebitTempo = summaryResults.find(s => s.transaction_type === 'debit_tempo')?.total || 0;
    const totalKreditTempo = summaryResults.find(s => s.transaction_type === 'kredit_tempo')?.total || 0;
    const saldo = parseFloat(totalDebitTempo) - parseFloat(totalKreditTempo);

    // Calculate running balance
    const allFilteredTransactions = await CashTransaction.findAll({
      where: whereClause,
      order: [['created_at', 'ASC']],
      attributes: ['id', 'transaction_type', 'amount']
    });

    const balanceLookup = {};
    let runningBalance = 0;
    allFilteredTransactions.forEach(transaction => {
      if (transaction.transaction_type === 'debit_tempo') {
        runningBalance += parseFloat(transaction.amount);
      } else {
        runningBalance -= parseFloat(transaction.amount);
      }
      balanceLookup[transaction.id] = runningBalance;
    });

    const enhancedTransactions = result.rows.map(transaction => {
      const transactionData = transaction.toJSON();
      return {
        ...transactionData,
        running_balance: balanceLookup[transaction.id] || 0
      };
    });

    res.json({
      success: true,
      data: enhancedTransactions,
      summary: {
        total_debit_tempo: parseFloat(totalDebitTempo),
        total_kredit_tempo: parseFloat(totalKreditTempo),
        saldo
      },
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (err) {
    console.error('Error in getAllTempoTransactions:', err);
    next(err);
  }
};

// Create new cash transaction
exports.createCashTransaction = async (req, res, next) => {
  if (!req.body) {
        return res.status(400).json({ success: false, message: 'Invalid request format' });
    }
  const transaction = await db.sequelize.transaction();
  
  try {
    const {
      transaction_type,
      category_id,
      amount,
      description,
      reference_number,
      transaction_date,
      account
    } = req.body;

    // Get attachment URL if a file was uploaded
    const attachment_url = req.file ? `uploads/receipts/${req.file.filename}` : null;

    // Validation
    if (!transaction_type || !['debit', 'kredit', 'debit_tempo', 'kredit_tempo'].includes(transaction_type)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (!description || description.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    const cashTransaction = await CashTransaction.create({
      transaction_type,
      category_id: category_id || null,
      amount: parseFloat(amount),
      description: description.trim(),
      reference_number: reference_number || null,
      transaction_date: transaction_date || new Date(),
      account,
      attachment_url // Save the file path
    }, { transaction });

    const createdTransaction = await CashTransaction.findByPk(cashTransaction.id, {
      include: [{ model: CashCategory, as: 'category', required: false }],
      transaction
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Cash transaction created successfully',
      data: createdTransaction
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in createCashTransaction:', err);
    next(err);
  }
};

// Get cash transaction by ID
exports.getCashTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID. Must be a number.'
      });
    }
    
    const cashTransaction = await CashTransaction.findByPk(parseInt(id), {
      include: [{
        model: CashCategory,
        as: 'category',
        required: false
      }]
    });

    if (!cashTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Cash transaction not found'
      });
    }

    res.json({
      success: true,
      data: cashTransaction
    });
  } catch (err) {
    console.error('Error in getCashTransactionById:', err);
    next(err);
  }
};

// Update cash transaction
exports.updateCashTransaction = async (req, res, next) => {
  const dbTransaction = await db.sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      transaction_type,
      category_id,
      amount,
      description,
      reference_number,
      transaction_date,
      account
    } = req.body;

    if (isNaN(parseInt(id))) {
      await dbTransaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID. Must be a number.'
      });
    }

    const cashTransaction = await CashTransaction.findByPk(parseInt(id), {
      transaction: dbTransaction
    });
    
    if (!cashTransaction) {
      await dbTransaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cash transaction not found'
      });
    }
    let attachment_url = cashTransaction.attachment_url; // Keep existing if no new file
      if (req.file) {
        attachment_url = `uploads/receipts/${req.file.filename}`;
      }

    // Validation
    if (transaction_type && !['debit', 'kredit', 'debit_tempo', 'kredit_tempo'].includes(transaction_type)) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    if (amount && parseFloat(amount) <= 0) {
      await dbTransaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    await cashTransaction.update({
      transaction_type: transaction_type || cashTransaction.transaction_type,
      category_id: category_id !== undefined ? category_id : cashTransaction.category_id,
      amount: amount ? parseFloat(amount) : cashTransaction.amount,
      description: description ? description.trim() : cashTransaction.description,
      reference_number: reference_number !== undefined ? reference_number : cashTransaction.reference_number,
      transaction_date: transaction_date || cashTransaction.transaction_date,
      account: account || cashTransaction.account,
      attachment_url: attachment_url
    }, { transaction: dbTransaction });

    // Get updated transaction with category
    const updatedTransaction = await CashTransaction.findByPk(parseInt(id), {
      include: [{
        model: CashCategory,
        as: 'category',
        required: false
      }],
      transaction: dbTransaction
    });

    await dbTransaction.commit();

    res.json({
      success: true,
      message: 'Cash transaction updated successfully',
      data: updatedTransaction
    });
  } catch (err) {
    await dbTransaction.rollback();
    console.error('Error in updateCashTransaction:', err);
    next(err);
  }
};

// Delete cash transaction
exports.deleteCashTransaction = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID. Must be a number.'
      });
    }
    
    const cashTransaction = await CashTransaction.findByPk(parseInt(id), {
      transaction
    });
    
    if (!cashTransaction) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cash transaction not found'
      });
    }

    await cashTransaction.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: 'Cash transaction deleted successfully'
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in deleteCashTransaction:', err);
    next(err);
  }
};

// Get cash categories
exports.getCashCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    
    let whereClause = {};
    if (type && ['income', 'expense'].includes(type)) {
      whereClause.category_type = type;
    }

    const categories = await CashCategory.findAll({
      where: whereClause,
      order: [['category_name', 'ASC']]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error('Error in getCashCategories:', err);
    next(err);
  }
};
