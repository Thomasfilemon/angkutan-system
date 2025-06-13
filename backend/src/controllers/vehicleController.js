const { Vehicle, VehicleService } = require('../models');

exports.getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
};

exports.getServiceHistory = async (req, res, next) => {
  try {
    const { vehicle_id } = req.query;
    if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id is required' });
    const history = await VehicleService.findAll({
      where: { vehicle_id },
      order: [['service_date', 'DESC']],
      limit: 10
    });
    res.json(history);
  } catch (err) {
    next(err);
  }
};
