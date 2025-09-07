const express = require('express');
const router = express.Router();
const tempoDetailController = require('../../controllers/web/tempoDetails.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Apply auth middleware to all routes
router.use(verifyToken);

// Tempo details routes
router.get('/', tempoDetailController.getAllTempoDetails);
router.get('/unique-suppliers', tempoDetailController.getUniqueSuppliers);
router.delete('/:id', tempoDetailController.deleteTempoDetail);

module.exports = router;