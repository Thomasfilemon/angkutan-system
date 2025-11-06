// src/controllers/driver.controller.js

const { User, DriverProfile, sequelize } = require('../models');
const { Op } = require('sequelize');
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


// Generate unique 16-digit ID card number
const generateUniqueIdCardNumber = async (transaction) => {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // Generate a 16-digit number: YYYYMMDD + 8 random digits
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD (8 digits)
    const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 random digits
    const idCardNumber = datePart + randomPart;
    
    // Check if this ID card number already exists
    const existing = await DriverProfile.findOne({
      where: { id_card_number: idCardNumber },
      transaction
    });
    
    if (!existing) {
      return idCardNumber;
    }
    
    attempts++;
  }
  
  // Fallback: use timestamp + random if all attempts fail
  const timestamp = Date.now().toString().slice(-10); // Last 10 digits of timestamp
  const random = Math.floor(100000 + Math.random() * 900000).toString(); // 6 random digits
  return timestamp + random;
};

// POST a new driver
exports.createDriver = async (req, res, next) => {
  const body = req.body || {};
  const { username, password, ...profileData } = body;
  const t = await sequelize.transaction();

  try {
    // Pre-validation: Check required fields with clear messages
    const validationErrors = [];

    if (!username || username.trim() === '') {
      validationErrors.push('Username is required');
    } else if (username.length < 3) {
      validationErrors.push('Username must be at least 3 characters long');
    }

    if (!password || password.trim() === '') {
      validationErrors.push('Password is required');
    } else if (password.length < 6) {
      validationErrors.push('Password must be at least 6 characters long');
    }

    if (!profileData.full_name || profileData.full_name.trim() === '') {
      validationErrors.push('Full name is required');
    } else if (profileData.full_name.trim().length < 2) {
      validationErrors.push('Full name must be at least 2 characters long');
    } else if (profileData.full_name.trim().length > 100) {
      validationErrors.push('Full name must not exceed 100 characters');
    }

    if (!profileData.phone || profileData.phone.trim() === '') {
      validationErrors.push('Phone number is required');
    } else {
      // Validate Indonesian phone number format
      const cleanPhone = profileData.phone.replace(/\s|-/g, '');
      const phoneRegex = /^(\+62|62|0)[0-9]{8,13}$/;
      if (!phoneRegex.test(cleanPhone)) {
        validationErrors.push('Phone number must be a valid Indonesian phone number (e.g., 081234567890, +6281234567890, or 6281234567890)');
      }
    }

    if (!profileData.address || profileData.address.trim() === '') {
      validationErrors.push('Address is required');
    } else {
      const trimmedAddress = profileData.address.trim();
      const addressWords = trimmedAddress.split(/\s+/).filter(word => word.length > 0);
      
      if (addressWords.length < 10) {
        validationErrors.push('Address must contain at least 10 words');
      }
      
      if (trimmedAddress.length < 10) {
        validationErrors.push('Address must be at least 10 characters long');
      }
      
      if (trimmedAddress.length > 500) {
        validationErrors.push('Address must not exceed 500 characters');
      }
    }

    // Validate license_type if provided
    if (profileData.license_type && profileData.license_type.trim() !== '') {
      const validLicenseTypes = ['A', 'B1', 'B2', 'C', 'D'];
      const licenseType = profileData.license_type.trim().toUpperCase();
      if (!validLicenseTypes.includes(licenseType)) {
        validationErrors.push(`License type must be one of: ${validLicenseTypes.join(', ')}`);
      }
    }

    // Validate status if provided
    if (profileData.status && profileData.status.trim() !== '') {
      const validStatuses = ['available', 'busy'];
      const status = profileData.status.trim().toLowerCase();
      if (!validStatuses.includes(status)) {
        validationErrors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Check for duplicate username before creating user
    if (username && username.trim() !== '') {
      const existingUser = await User.findOne({
        where: { username: username.trim().toLowerCase() },
        transaction: t
      });
      if (existingUser) {
        validationErrors.push('Username already exists');
      }
    }

    if (validationErrors.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
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

    // Auto-generate id_card_number if missing or empty
    let idCardNumber = profileData.id_card_number;
    if (!idCardNumber || (typeof idCardNumber === 'string' && idCardNumber.trim() === '')) {
      idCardNumber = await generateUniqueIdCardNumber(t);
    } else {
      // Clean the provided ID card number (remove spaces/hyphens)
      if (typeof idCardNumber === 'string') {
        idCardNumber = idCardNumber.replace(/\s|-/g, '');
      } else {
        idCardNumber = String(idCardNumber);
      }
      // Validate it's 16 digits
      if (!/^[0-9]{16}$/.test(idCardNumber)) {
        await t.rollback();
        return res.status(400).json({ message: 'ID card number must be 16 digits' });
      }
      // Check if it already exists
      const existing = await DriverProfile.findOne({
        where: { id_card_number: idCardNumber },
        transaction: t
      });
      if (existing) {
        await t.rollback();
        return res.status(400).json({ message: 'ID card number already exists' });
      }
    }

    // Handle sim_number: convert empty strings to null to avoid unique constraint violations
    let simNumber = profileData.sim_number;
    if (!simNumber || (typeof simNumber === 'string' && simNumber.trim() === '')) {
      simNumber = null;
    } else if (typeof simNumber === 'string') {
      simNumber = simNumber.trim();
      // Check if the provided SIM number already exists
      const existingSim = await DriverProfile.findOne({
        where: { sim_number: simNumber },
        transaction: t
      });
      if (existingSim) {
        await t.rollback();
        return res.status(400).json({ message: 'SIM number already exists' });
      }
    }

    await DriverProfile.create({
      ...profileData,
      id_card_number: idCardNumber,
      sim_number: simNumber,
      ktp_image_url,
      sim_image_url,
      user_id: user.id,
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: 'Driver created successfully.' });
  } catch (err) {
    await t.rollback();
    
    // Handle Sequelize validation errors with detailed messages
    if (err.name === 'SequelizeValidationError') {
      const errorMessages = err.errors.map((error) => {
        // Map field names to user-friendly names
        let fieldName = error.path || 'field';
        const fieldMap = {
          'full_name': 'Full name',
          'phone': 'Phone number',
          'address': 'Address',
          'id_card_number': 'ID card number',
          'sim_number': 'SIM number',
          'license_type': 'License type',
          'status': 'Status',
          'username': 'Username'
        };
        fieldName = fieldMap[fieldName] || fieldName;
        
        // Return user-friendly error message
        return `${fieldName}: ${error.message}`;
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }
    
    // Handle unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
      const fieldMap = {
        'username': 'Username',
        'id_card_number': 'ID card number',
        'sim_number': 'SIM number',
        'user_id': 'User'
      };
      
      const violatedField = err.errors?.[0]?.path || 'field';
      const fieldName = fieldMap[violatedField] || violatedField;
      
      let errorMessage = `${fieldName} already exists`;
      if (err.errors?.[0]?.message) {
        errorMessage = err.errors[0].message;
      }
      
      return res.status(409).json({
        success: false,
        message: 'Conflict',
        errors: [errorMessage]
      });
    }
    
    // Log unexpected errors for debugging
    console.error('Unexpected error in createDriver:', err);
    
    // Return generic error message
    return res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      errors: ['An unexpected error occurred. Please try again.']
    });
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

    // Handle sim_number: convert empty strings to null to avoid unique constraint violations
    if (updates.sim_number !== undefined) {
      if (!updates.sim_number || (typeof updates.sim_number === 'string' && updates.sim_number.trim() === '')) {
        updates.sim_number = null;
      } else if (typeof updates.sim_number === 'string') {
        updates.sim_number = updates.sim_number.trim();
        // Check if the provided SIM number already exists (excluding current driver)
        const existingSim = await DriverProfile.findOne({
          where: { 
            sim_number: updates.sim_number,
            user_id: { [Op.ne]: id }
          }
        });
        if (existingSim) {
          return res.status(400).json({ message: 'SIM number already exists' });
        }
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
