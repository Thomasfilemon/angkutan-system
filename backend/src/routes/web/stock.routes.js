// src/routes/web/stock.routes.js
const express = require("express");
const stockRouter = express.Router();
const stockController = require("../../controllers/web/stockController");
const { verifyToken } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware"); // 👈 Import the middleware

stockRouter.use(verifyToken);

// Categories route MUST come BEFORE the /:id route
stockRouter.get('/categories', stockController.getStockCategories);
// Suppliers distinct list for autocomplete
stockRouter.get('/suppliers', stockController.getDistinctSuppliers);

// Usage notes (stok yang langsung digunakan) - MUST come BEFORE /:id routes
stockRouter.post('/usage-notes', stockController.createUsageNote);
stockRouter.get('/usage-notes', stockController.listUsageNotes);
stockRouter.get('/usage-notes/:id', stockController.getUsageNoteDetail);
stockRouter.delete('/usage-notes/:id', stockController.deleteUsageNote);

// Stock items routes
stockRouter.get('/batches/:batchId/history', stockController.getStockBatchHistory);
// NEW: Aggregated stock per item_name (merge different suppliers/brands)
stockRouter.get('/summary/by-name', stockController.getAggregatedStockByName);
stockRouter.get('/', stockController.getAllStockItems);
stockRouter.post('/', stockController.createStockItem);
stockRouter.post('/adjust', stockController.adjustStock);
stockRouter.get('/:id/batches', stockController.getStockBatches);

stockRouter.get('/:id', stockController.getStockItemById);
stockRouter.put('/:id', stockController.updateStockItem);
stockRouter.delete('/:id', stockController.deleteStockItem); // Add this line
stockRouter.post('/:id/add-stock', stockController.addStock);
stockRouter.get('/:id/history', stockController.getStockItemHistory);


module.exports = stockRouter;
