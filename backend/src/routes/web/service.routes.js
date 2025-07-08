// src/routes/web/service.routes.js
const express = require('express');
const serviceRouter = express.Router();
const serviceController = require('../../controllers/web/serviceController');
const { verifyToken } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware'); // 👈 Import the middleware


serviceRouter.use(verifyToken);

serviceRouter.get('/', serviceController.getAllServices);
serviceRouter.post('/', upload.single('attachment'), serviceController.createService);
serviceRouter.get('/stock-items', serviceController.getAvailableStockItems);
serviceRouter.get('/:id', serviceController.getServiceById);
serviceRouter.put('/:id', serviceController.updateService);
serviceRouter.patch('/:id/cancel', serviceController.cancelService);

module.exports = serviceRouter;
