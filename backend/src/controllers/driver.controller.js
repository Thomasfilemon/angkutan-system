// src/controllers/driver.controller.js

const { User, DriverProfile, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

// GET all drivers
exports.getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await User.findAll({
      where: { role: 'driver' },
      include: [{
        model: DriverProfile,
        as: 'driverProfile',
        required: true,
      }],
      attributes: ['id', 'username', 'role']
    });
    res.json(drivers);
  } catch (err) {
    next(err);
  }
};


// POST a new driver
exports.createDriver = async (req, res, next) => {
  const { username, password, ...profileData } = req.body;
  const t = await sequelize.transaction();

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password_hash: passwordHash,
      role: 'driver'
    }, { transaction: t });

    await DriverProfile.create({
      ...profileData,
      user_id: user.id,
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: 'Driver created successfully.' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getDriverById = async (req, res, next) => {
  try {
    const driver = await User.findOne({
      where: { id: req.params.id, role: 'driver' },
      include: [{
        model: DriverProfile,
        as: 'driverProfile',
        required: true,
      }],
      attributes: ['id', 'username', 'role']
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json(driver);
  } catch (err) {
    next(err);
  }
};

exports.updateDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, phone, address, status, ...otherData } = req.body;

    const driverProfile = await DriverProfile.findOne({ where: { user_id: id } });

    if (!driverProfile) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    await driverProfile.update({ full_name, phone, address, status, ...otherData });

    res.json({ message: 'Driver updated successfully.' });
  } catch (err) {
    next(err);
  }
};

exports.deleteDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ where: { id, role: 'driver' } });

    if (!user) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    await user.destroy();
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
