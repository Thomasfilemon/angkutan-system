// src/routes/driver.routes.js

const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driver.controller');

// Import your authentication and authorization middleware
// The path must match your project structure.
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');
const uploadMemory = require('../middlewares/uploadMemory.middleware');

// === Apply Global Authentication ===
// This line ensures that a user must have a valid token to access ANY of the driver routes.
router.use(verifyToken);

// === Define CRUD Routes with Role-Based Authorization ===

// GET all drivers: Only admins and owners can see the full list.
router.get('/', checkRole(['admin', 'owner']), driverController.getAllDrivers);

router.get('/:id', checkRole(['admin', 'owner']), driverController.getDriverById);

// POST a new driver: Only admins and owners can create new drivers.
router.post(
  '/',
  checkRole(['admin', 'owner']),
  uploadMemory.fields([
    { name: 'ktp_image', maxCount: 1 },
    { name: 'sim_image', maxCount: 1 },
  ]),
  driverController.createDriver
);

// PUT (update) a driver: Only admins and owners can update driver info.
router.put(
  '/:id',
  checkRole(['admin', 'owner']),
  uploadMemory.fields([
    { name: 'ktp_image', maxCount: 1 },
    { name: 'sim_image', maxCount: 1 },
  ]),
  driverController.updateDriver
);

// DELETE a driver: Only admins and owners can delete drivers.
router.delete('/:id', checkRole(['admin', 'owner']), driverController.deleteDriver);

module.exports = router;
