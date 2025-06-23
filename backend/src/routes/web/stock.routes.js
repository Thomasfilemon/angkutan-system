// src/routes/web/stock.routes.js
const express = require('express');
const stockRouter = express.Router();
const stockController = require('../../controllers/web/stockController');
const { verifyToken } = require('../../middlewares/auth.middleware');

stockRouter.use(verifyToken);

// Stock items
stockRouter.get('/', stockController.getAllStockItems);
stockRouter.post('/', stockController.createStockItem);
stockRouter.get('/:id', stockController.getStockItemById);
stockRouter.put('/:id', stockController.updateStockItem);
stockRouter.post('/:id/add-stock', stockController.addStock);

// Categories
stockRouter.get('/categories', stockController.getStockCategories);

module.exports = stockRouter;
