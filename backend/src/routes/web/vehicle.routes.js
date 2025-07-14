// src/routes/web/vehicle.routes.js
const express = require("express");
const vehicleRouter = express.Router();
// FIX: Changed to point to the correct vehicleController as requested.
const oldVehicleController = require("../../controllers/vehicleController");
const vehicleController = require("../../controllers/web/webvehicleController");

const { verifyToken, checkRole } = require("../../middlewares/auth.middleware");

vehicleRouter.use(verifyToken);

// --- Static and Collection Routes ---
vehicleRouter.get(
  "/statistics",
  checkRole(["admin", "owner"]),
  vehicleController.getVehicleStatistics
);
vehicleRouter.get(
  "/drivers/available",
  checkRole(["admin", "owner"]),
  vehicleController.getAvailableDrivers
);
vehicleRouter.get(
  "/",
  checkRole(["admin", "owner"]),
  vehicleController.getAllVehicles
);
vehicleRouter.post(
  "/",
  checkRole(["admin", "owner"]),
  vehicleController.createVehicle
);

// --- Parameterized Routes for a Single Vehicle ---
vehicleRouter.get(
  "/:id",
  checkRole(["admin", "owner"]),
  vehicleController.getVehicleById
);
vehicleRouter.put(
  "/:id",
  checkRole(["admin", "owner"]),
  vehicleController.updateVehicle
);
vehicleRouter.delete(
  "/:id",
  checkRole(["admin", "owner"]),
  vehicleController.deleteVehicle
);

vehicleRouter.patch(
  "/:id/assign-driver",
  checkRole(["admin", "owner"]),
  vehicleController.assignDriver
);
vehicleRouter.get(
  "/:id/history",
  checkRole(["admin", "owner"]),
  vehicleController.getServiceHistory
);

module.exports = vehicleRouter;
