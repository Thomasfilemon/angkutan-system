const express = require('express');
const router = express.Router();
const driverController = require('../../controllers/driver.controller');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');
const uploadMemory = require('../../middlewares/uploadMemory.middleware');

// Apply global authentication
router.use(verifyToken);

// Web-specific driver routes (same as mobile for now)
router.get('/', checkRole(['admin', 'owner']), driverController.getAllDrivers);
router.get('/:id', checkRole(['admin', 'owner']), driverController.getDriverById);
router.post(
  '/',
  checkRole(['admin', 'owner']),
  uploadMemory.fields([
    { name: 'ktp_image', maxCount: 1 },
    { name: 'sim_image', maxCount: 1 },
  ]),
  driverController.createDriver
);
router.put(
  '/:id',
  checkRole(['admin', 'owner']),
  uploadMemory.fields([
    { name: 'ktp_image', maxCount: 1 },
    { name: 'sim_image', maxCount: 1 },
  ]),
  driverController.updateDriver
);
router.delete('/:id', checkRole(['admin', 'owner']), driverController.deleteDriver);

module.exports = router;
