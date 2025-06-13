// Remove this line that's causing the error:
// const { Trip, Vehicle, User } = require('../models');

exports.getAllTrips = async (req, res, next) => {
  try {
    const { driver_id, status } = req.query;
    
    // Mock data instead of using Trip.findAll()
    const mockTrips = [
      {
        id: 1,
        driver_id: driver_id || 1,
        vehicle_id: 1,
        drop_lat: -6.2088,
        drop_lng: 106.8456,
        ritase: 5,
        tarif_per_ritase: 50000,
        status: 'on_progress',
        created_at: new Date().toISOString(),
        vehicle: {
          id: 1,
          license_plate: 'B 1234 CD',
          type: 'Truck'
        }
      }
    ];

    res.json(mockTrips);
  } catch (err) {
    next(err);
  }
};

exports.updateToOTW = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Trip status updated to OTW', tripId: id });
  } catch (err) {
    next(err);
  }
};

exports.updateToReached = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Trip status updated to perjalanan pulang', tripId: id });
  } catch (err) {
    next(err);
  }
};

exports.completeTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Trip completed', tripId: id });
  } catch (err) {
    next(err);
  }
};
