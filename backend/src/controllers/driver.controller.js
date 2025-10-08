// src/controllers/driver.controller.js

const { User, DriverProfile, sequelize } = require('../models');
const uploadMemory = require('../middlewares/uploadMemory.middleware');
const { uploadToFolderFromBuffer } = require('../services/cloudinary.service');
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
  const body = req.body || {};
  const { username, password, ...profileData } = body;
  const t = await sequelize.transaction();

  try {
    if (!username || !password) {
      await t.rollback();
      return res.status(400).json({ message: 'username and password are required' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password_hash: passwordHash,
      role: 'driver'
    }, { transaction: t });

    // Optional KTP/SIM images from multipart form (memory storage)
    let ktp_image_url = null;
    let sim_image_url = null;
    if (req.files) {
      const ktpFile = Array.isArray(req.files.ktp_image)
        ? req.files.ktp_image[0]
        : req.files.ktp_image;
      const simFile = Array.isArray(req.files.sim_image)
        ? req.files.sim_image[0]
        : req.files.sim_image;
      if (ktpFile?.buffer) {
        const uploaded = await uploadToFolderFromBuffer(ktpFile.buffer, 'drivers/ktp');
        ktp_image_url = uploaded.secure_url;
      }
      if (simFile?.buffer) {
        const uploaded = await uploadToFolderFromBuffer(simFile.buffer, 'drivers/sim');
        sim_image_url = uploaded.secure_url;
      }
    }

    await DriverProfile.create({
      ...profileData,
      ktp_image_url,
      sim_image_url,
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
    const body = req.body || {};
    const { full_name, phone, address, status, ...otherData } = body;

    const driverProfile = await DriverProfile.findOne({ where: { user_id: id } });

    if (!driverProfile) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    // Optional KTP/SIM images from multipart
    let updates = { full_name, phone, address, status, ...otherData };
    if (req.files) {
      const ktpFile = Array.isArray(req.files.ktp_image)
        ? req.files.ktp_image[0]
        : req.files.ktp_image;
      const simFile = Array.isArray(req.files.sim_image)
        ? req.files.sim_image[0]
        : req.files.sim_image;
      if (ktpFile?.buffer) {
        const uploaded = await uploadToFolderFromBuffer(ktpFile.buffer, 'drivers/ktp');
        updates.ktp_image_url = uploaded.secure_url;
      }
      if (simFile?.buffer) {
        const uploaded = await uploadToFolderFromBuffer(simFile.buffer, 'drivers/sim');
        updates.sim_image_url = uploaded.secure_url;
      }
    }

    await driverProfile.update(updates);

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
