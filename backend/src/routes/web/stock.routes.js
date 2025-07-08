// src/routes/web/stock.routes.js
const express = require('express');
const stockRouter = express.Router();
const stockController = require('../../controllers/web/stockController');
const { verifyToken } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware'); // 👈 Import the middleware

stockRouter.use(verifyToken);

// Categories route MUST come BEFORE the /:id route
stockRouter.get('/categories', stockController.getStockCategories);

// Stock items routes
stockRouter.get('/', stockController.getAllStockItems);
stockRouter.post('/', stockController.createStockItem);
stockRouter.post('/adjust', stockController.adjustStock);

stockRouter.get('/:id', stockController.getStockItemById);
stockRouter.put('/:id', stockController.updateStockItem);
stockRouter.delete('/:id', stockController.deleteStockItem); // Add this line
stockRouter.post('/:id/add-stock', stockController.addStock);
stockRouter.get('/:id/history', stockController.getStockItemHistory);


module.exports = stockRouter;
