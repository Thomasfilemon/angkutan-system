const { DriverExpense, Trip } = require('../models');

exports.getExpenses = async (req, res, next) => {
  try {
    const { trip_id, driver_id } = req.query;
    let where = {};
    if (trip_id) where.trip_id = trip_id;
    if (driver_id) where.driver_id = driver_id;
    const expenses = await DriverExpense.findAll({
      where,
      include: [{ model: Trip, as: 'trip' }],
      order: [['created_at', 'DESC']]
    });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const { trip_id, driver_id, jenis, amount } = req.body;
    const receipt_url = req.file ? req.file.path : null;
    if (!trip_id || !driver_id || !jenis || !amount) {
      return res.status(400).json({ error: 'trip_id, driver_id, jenis, and amount are required' });
    }
    const expense = await DriverExpense.create({
      trip_id: parseInt(trip_id),
      driver_id: parseInt(driver_id),
      jenis,
      amount: parseFloat(amount),
      receipt_url
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};
