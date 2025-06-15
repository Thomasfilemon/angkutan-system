const express = require('express');
const router = express.Router();
const tripController = require('../controllers/deliveryOrder.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/', verifyToken, tripController.getAllTrips);
router.patch('/:id/otw', verifyToken, tripController.updateToOTW);
router.patch('/:id/sampai_tujuan', verifyToken, tripController.updateToReached);
router.patch('/:id/selesai', verifyToken, tripController.completeTrip);

module.exports = router;
