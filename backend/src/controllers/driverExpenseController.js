const db = require('../models'); // This correctly imports all your Sequelize models
const path = require('path');
const fs = require('fs'); // We need the File System module to delete old receipts on update/delete

/**
 * @desc    Create a new driver expense
 * @route   POST /api/driver-expenses
 * @access  Private (Driver only)
 */
exports.createExpense = async (req, res) => {
  const { jenis, amount, notes, delivery_order_id } = req.body;
  const driver_id = req.user.id; // Get driver ID from the verifyToken middleware

  try {
    // Basic server-side validation for required fields
    if (!delivery_order_id || !jenis || !amount) {
      return res.status(400).json({ message: 'Delivery Order ID, Type (jenis), and Amount are required.' });
    }

    // The DriverExpense model will handle more detailed validation automatically
    const newExpense = await db.DriverExpense.create({
      driver_id,
      delivery_order_id,
      jenis,
      amount,
      notes,
      // Use the path from multer if a file was uploaded, otherwise null
      receipt_url: req.file ? req.file.path.replace(/\\/g, "/") : null, 
    });

    res.status(201).json(newExpense);
  } catch (error) {
    // Catch validation errors from Sequelize and return a helpful message
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'Failed to create expense', error: error.message });
  }
};

/**
 * @desc    Get all expenses for the logged-in driver
 * @route   GET /api/driver-expenses
 * @access  Private (Driver only)
 */
exports.getExpenses = async (req, res) => {
  const driver_id = req.user.id;

  try {
    // We use the custom 'findByDriver' method you defined in your model!
    const expenses = await db.DriverExpense.findByDriver(driver_id, {
      // You can pass more options here later if needed, e.g., for filtering
    });

    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Failed to fetch expenses', error: error.message });
  }
};


/**
 * @desc    Get a single expense by its ID
 * @route   GET /api/driver-expenses/:id
 * @access  Private (Owner or Admin)
 */
exports.getExpenseById = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const expense = await db.DriverExpense.findByPk(id, {
      // Include associated data for context
      include: [
        { model: db.DeliveryOrder, as: 'DeliveryOrder', attributes: ['do_number', 'customer_name'] },
        { model: db.User, as: 'driver', attributes: ['id', 'username'] }
      ]
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    // Security check: Only the user who created it or an admin can view it
    if (expense.driver_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'Access forbidden.' });
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error(`Error fetching expense ${id}:`, error);
    res.status(500).json({ message: 'Failed to fetch expense.', error: error.message });
  }
};


/**
 * @desc    Delete an expense
 * @route   DELETE /api/driver-expenses/:id
 * @access  Private (Owner or Admin)
 */
exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const expense = await db.DriverExpense.findByPk(id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    // Security check
    if (expense.driver_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'Access forbidden.' });
    }

    // If a receipt file exists, delete it from the server
    if (expense.receipt_url) {
      const filePath = path.resolve(expense.receipt_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await expense.destroy(); // Deletes the record from the database

    res.status(204).send(); // Standard response for successful delete
  } catch (error) {
    console.error(`Error deleting expense ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete expense.', error: error.message });
  }
};
