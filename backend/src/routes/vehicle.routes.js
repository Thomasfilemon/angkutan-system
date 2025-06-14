const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/:id', verifyToken, vehicleController.getVehicleById);
router.get('/service/history', verifyToken, vehicleController.getServiceHistory);

module.exports = router;
