// src/controllers/web/tireController.js
const { Vehicle, VehicleTire, TireInventory, TireInspection, TireInstance } = require('../../models');
const { Op } = require('sequelize');

// Update tire data (pressure, temperature, etc.)
exports.updateTireData = async (req, res, next) => {
  try {
    const { tireId } = req.params; // This is VehicleTire ID
    const { current_pressure, temperature, tread_depth, condition, notes } = req.body;
    
    const tire = await VehicleTire.findByPk(tireId);
    
    if (!tire) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle tire installation not found'
      });
    }

    // Update tire data
    await tire.update({
      current_pressure: current_pressure ?? tire.current_pressure,
      temperature: temperature ?? tire.temperature,
      tread_depth: tread_depth ?? tire.tread_depth,
      condition: condition ?? tire.condition,
      notes: notes ?? tire.notes
    });

    // Create inspection record for history
    await TireInspection.create({
      vehicle_tire_id: tire.id,
      tire_instance_id: tire.tire_instance_id,
      inspection_date: new Date(),
      tread_depth: tread_depth ?? tire.tread_depth,
      air_pressure: current_pressure ?? tire.current_pressure,
      temperature: temperature ?? tire.temperature,
      condition: condition ?? tire.condition,
      notes: `Inspection: ${notes || 'Routine update'}`,
      inspector_name: req.user?.username || 'System'
    });

    res.json({
      success: true,
      message: 'Tire data updated successfully',
      data: tire
    });
  } catch (err) {
    next(err);
  }
};

// REMOVED: The old installTire function is deprecated in favor of installTireInstance.

// Remove tire from vehicle
exports.removeTire = async (req, res, next) => {
  try {
    const { tireId } = req.params; // This is VehicleTire ID
    const { reason, notes } = req.body;
    
    const vehicleTire = await VehicleTire.findByPk(tireId, {
      include: [
        {
          model: TireInstance,
          as: 'tireInstance'
        }
      ]
    });
    
    if (!vehicleTire) {
      return res.status(404).json({
        success: false,
        message: 'Tire installation record not found'
      });
    }

    if (vehicleTire.status === 'removed') {
        return res.status(400).json({
            success: false,
            message: 'This tire has already been removed.'
        });
    }

    // Update vehicle tire status to removed
    await vehicleTire.update({
      status: 'removed',
      remove_date: new Date(),
      notes: `${vehicleTire.notes || ''}\nRemoved: ${reason || 'No reason specified'}. ${notes || ''}`.trim()
    });

    // Update tire instance status to 'removed' so it becomes available in "Ban Bekas" inventory
    if (vehicleTire.tireInstance) {
      await vehicleTire.tireInstance.update({
        status: 'removed',
        notes: `${vehicleTire.tireInstance.notes || ''}\nRemoved from vehicle on ${new Date().toISOString()}`.trim()
      });
    } else {
       // This case should not happen with the new NOT NULL constraint, but as a safeguard:
       console.warn(`VehicleTire ID ${vehicleTire.id} was removed but had no associated TireInstance.`);
    }

    res.json({
      success: true,
      message: 'Tire removed successfully and is now available in used tire inventory.'
    });
  } catch (err) {
    next(err);
  }
};

exports.createTireInventory = async (req, res, next) => {
  try {
    const tire = await TireInventory.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Tire inventory created successfully',
      data: tire
    });
  } catch (err) {
    next(err);
  }
};


// Get all tire inventory
exports.getAllTireInventory = async (req, res, next) => {
  try {
    const inventory = await TireInventory.findAll({
      order: [['tire_brand', 'ASC'], ['tire_size', 'ASC']]
    });

    res.json({
      success: true,
      data: inventory
    });
  } catch (err) {
    next(err);
  }
};

// Delete tire inventory item
exports.deleteTireInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tire = await TireInventory.findByPk(id);
    if (!tire) {
      return res.status(404).json({
        success: false,
        message: 'Tire not found'
      });
    }

    // Check if there are any associated tire instances before deleting
    const instanceCount = await TireInstance.count({ where: { tire_inventory_id: id } });
    if (instanceCount > 0) {
        return res.status(400).json({
            success: false,
            message: `Cannot delete inventory. ${instanceCount} tire instances are associated with it.`
        });
    }


    await tire.destroy();

    res.json({
      success: true,
      message: 'Tire deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};


exports.getTireInventory = async (req, res, next) => {
  try {
    const inventory = await TireInventory.findAll({
      where: {
        current_stock: {
          [Op.gt]: 0
        }
      },
      order: [['tire_brand', 'ASC'], ['tire_size', 'ASC']]
    });

    res.json({
      success: true,
      data: inventory
    });
  } catch (err) {
    next(err);
  }
};

exports.getTireInventoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tire = await TireInventory.findByPk(id);
    
    if (!tire) {
      return res.status(404).json({
        success: false,
        message: 'Tire not found'
      });
    }

    res.json({
      success: true,
      data: tire
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTireInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tire = await TireInventory.findByPk(id);
    
    if (!tire) {
      return res.status(404).json({
        success: false,
        message: 'Tire not found'
      });
    }

    await tire.update(req.body);

    res.json({
      success: true,
      message: 'Tire inventory updated successfully',
      data: tire
    });
  } catch (err) {
    next(err);
  }
};

// Get tire inspection history for a specific vehicle tire installation
exports.getTireInspectionHistory = async (req, res, next) => {
  try {
    const { tireId } = req.params; // This is VehicleTire ID
    
    const inspections = await TireInspection.findAll({
      where: { vehicle_tire_id: tireId },
      order: [['inspection_date', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      data: inspections
    });
  } catch (err) {
    next(err);
  }
};

// Get all vehicles for tire management dropdown
exports.getVehiclesForTireManagement = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.findAll({
      attributes: ['id', 'license_plate', 'type', 'tire_count', 'spare_tire_count', 'current_mileage'],
      order: [['license_plate', 'ASC']]
    });

    const formattedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      license_plate: vehicle.license_plate,
      type: vehicle.type,
      display_name: `${vehicle.license_plate} (${vehicle.type})`,
      tire_count: vehicle.tire_count,
      spare_tire_count: vehicle.spare_tire_count,
      total_tires: vehicle.tire_count + vehicle.spare_tire_count,
      current_mileage: vehicle.current_mileage
    }));

    res.json({
      success: true,
      data: formattedVehicles
    });
  } catch (err) {
    next(err);
  }
};

exports.createTireInstances = async (req, res, next) => {
  try {
    const { tire_inventory_id, quantity, purchase_price, purchase_date } = req.body;
    
    const inventory = await TireInventory.findByPk(tire_inventory_id);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Tire inventory not found'
      });
    }

    const instances = [];
    const createdSerialNumbers = new Set();

    for (let i = 1; i <= quantity; i++) {
        // Generate a unique serial number
        let serialNumber;
        do {
            serialNumber = `${inventory.tire_brand.substring(0, 3).toUpperCase()}${inventory.tire_size.replace(/[^0-9]/g, '')}-${Date.now().toString().slice(-6)}-${i}`;
        } while (createdSerialNumbers.has(serialNumber));
        
        createdSerialNumbers.add(serialNumber);

        const instance = await TireInstance.create({
            tire_inventory_id,
            tire_serial_number: serialNumber,
            purchase_date: purchase_date || new Date(),
            purchase_price: purchase_price || inventory.unit_price,
            condition: 'new',
            status: 'in_stock'
        });
        instances.push(instance);
    }


    // Update inventory stock by adding the quantity of new instances
    await inventory.increment('current_stock', { by: quantity });


    res.status(201).json({
      success: true,
      message: `${quantity} tire instances created successfully`,
      data: instances
    });
  } catch (err) {
    next(err);
  }
};

// Get available tire instances for installation. Can be filtered by status.
exports.getAvailableTireInstances = async (req, res, next) => {
  try {
    const { tire_inventory_id, status } = req.query;
    
    let whereClause = {
      condition: { [Op.in]: ['new', 'good', 'fair'] } // Only usable tires
    };
    
    if (status) {
      whereClause.status = status;
    } else {
      // Default to showing all available (new and used)
      whereClause.status = { [Op.in]: ['in_stock', 'removed'] };
    }
    
    if (tire_inventory_id) {
      whereClause.tire_inventory_id = tire_inventory_id;
    }

    const instances = await TireInstance.findAll({
      where: whereClause,
      include: [
        {
          model: TireInventory,
          as: 'tireInventory',
          attributes: ['tire_brand', 'tire_size', 'tire_type']
        },
        {
          model: VehicleTire,
          as: 'installations',
          attributes: ['remove_date'],
          include: [
            {
              model: Vehicle,
              as: 'vehicle',
              attributes: ['license_plate']
            }
          ],
          order: [['remove_date', 'DESC']],
          limit: 1,
          required: false,
        }
      ],
      order: [['status', 'ASC'], ['condition', 'ASC'], ['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: instances
    });
  } catch (err) {
    next(err);
  }
};


// Install specific tire instance
exports.installTireInstance = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { tire_instance_id, position, recommended_pressure, mileage_installed } = req.body;
    
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const tireInstance = await TireInstance.findByPk(tire_instance_id, {
      include: [{ model: TireInventory, as: 'tireInventory' }]
    });
    
    if (!tireInstance) {
      return res.status(404).json({
        success: false,
        message: 'Tire instance not found'
      });
    }

    if (!['in_stock', 'removed'].includes(tireInstance.status)) {
      return res.status(400).json({
        success: false,
        message: 'Tire instance is not available for installation (current status: ' + tireInstance.status + ')'
      });
    }

    // Check if position is valid
    const validPositions = vehicle.getTirePositions();
    if (!validPositions.includes(position)) {
      return res.status(400).json({
        success: false,
        message: `Invalid tire position '${position}' for this vehicle.`
      });
    }

    // Check if position is already occupied by an active tire
    const existingTire = await VehicleTire.findOne({
      where: {
        vehicle_id: vehicleId,
        position: position,
        status: 'active'
      }
    });

    if (existingTire) {
      return res.status(400).json({
        success: false,
        message: `Position '${position}' already has an active tire.`
      });
    }

    // Create vehicle tire installation record
    const vehicleTire = await VehicleTire.create({
      vehicle_id: vehicleId,
      tire_inventory_id: tireInstance.tire_inventory_id,
      tire_instance_id: tire_instance_id,
      position,
      install_date: new Date(),
      mileage_installed: mileage_installed || vehicle.current_mileage || 0,
      recommended_pressure: recommended_pressure || 35,
      current_pressure: recommended_pressure || 35,
      tread_depth: tireInstance.current_tread_depth,
      temperature: 25.0,
      condition: tireInstance.condition,
      status: 'active'
    });

    // Update tire instance status to 'installed'
    await tireInstance.update({
      status: 'installed',
    });

    // If the instance was new ('in_stock'), decrement the inventory count.
    // If it was 'removed', the stock count is not affected.
    if(tireInstance.status === 'in_stock'){
      const inventory = await TireInventory.findByPk(tireInstance.tire_inventory_id);
      if (inventory) {
        await inventory.decrement('current_stock', { by: 1 });
      }
    }


    res.status(201).json({
      success: true,
      message: 'Tire instance installed successfully',
      data: vehicleTire
    });
  } catch (err) {
    next(err);
  }
};

// Get tire instance history
exports.getTireInstanceHistory = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    
    const instance = await TireInstance.findByPk(instanceId, {
      include: [
        {
          model: TireInventory,
          as: 'tireInventory'
        },
        {
          model: VehicleTire,
          as: 'installations',
          include: [
            {
              model: Vehicle,
              as: 'vehicle',
              attributes: ['license_plate', 'type']
            }
          ]
        },
        {
          model: TireInspection,
          as: 'inspections',
          order: [['inspection_date', 'DESC']]
        }
      ]
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Tire instance not found'
      });
    }

    res.json({
      success: true,
      data: instance
    });
  } catch (err) {
    next(err);
  }
};

exports.getRemovedTireInstances = async (req, res, next) => {
  try {
    const removedTires = await TireInstance.findAll({
      where: {
        status: 'removed',
        condition: { [Op.in]: ['good', 'fair'] } // Only show reusable tires
      },
      include: [
        {
          model: TireInventory,
          as: 'tireInventory',
          attributes: ['tire_brand', 'tire_size', 'tire_type']
        },
        {
          model: VehicleTire,
          as: 'installations',
          include: [
            {
              model: Vehicle,
              as: 'vehicle',
              attributes: ['license_plate']
            }
          ],
          order: [['remove_date', 'DESC']],
          limit: 1,
          required: false
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    res.json({
      success: true,
      data: removedTires
    });
  } catch (err) {
    next(err);
  }
};

// Get vehicle tire status with tire instance data
exports.getVehicleTireStatus = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    
    const vehicle = await Vehicle.findByPk(vehicleId, {
      include: [
        {
          model: VehicleTire,
          as: 'tires',
          required: false,
          where: { status: 'active' },
          include: [
            {
              model: TireInstance,
              as: 'tireInstance',
              required: true, // This ensures we only get installations with a valid instance
              include: [
                {
                  model: TireInventory,
                  as: 'tireInventory',
                  required: true
                }
              ]
            }
          ]
        }
      ]
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const expectedPositions = vehicle.getTirePositions();
    const tireStatusMap = {};
    
    // Initialize all expected positions as empty
    expectedPositions.forEach(position => {
      tireStatusMap[position] = {
        position,
        installed: false,
        tire: null
      };
    });
    
    // Fill in the installed tires
    vehicle.tires.forEach(tire => {
      if (tireStatusMap[tire.position] && tire.tireInstance) {
        const tireInfo = tire.tireInstance.tireInventory;
        
        tireStatusMap[tire.position] = {
          position: tire.position,
          installed: true,
          tire: {
            id: tire.id, // This is the vehicle_tire ID
            instance_id: tire.tire_instance_id,
            serial_number: tire.tireInstance.tire_serial_number,
            current_pressure: tire.current_pressure,
            recommended_pressure: tire.recommended_pressure,
            temperature: tire.temperature,
            tread_depth: tire.tread_depth,
            condition: tire.condition,
            install_date: tire.install_date,
            updated_at: tire.updated_at, // Added update date
            brand: tireInfo.tire_brand,
            size: tireInfo.tire_size,
            total_mileage: tire.tireInstance.total_mileage,
            isPressureLow: tire.isPressureLow(),
            isPressureHigh: tire.isPressureHigh(),
            isTemperatureHigh: tire.isTemperatureHigh(),
            needsReplacement: tire.needsReplacement()
          }
        };
      }
    });

    const responseData = {
      vehicle: {
        id: vehicle.id,
        license_plate: vehicle.license_plate,
        type: vehicle.type,
        tire_count: vehicle.tire_count,
        spare_tire_count: vehicle.spare_tire_count,
        tire_positions: expectedPositions,
        current_mileage: vehicle.current_mileage
      },
      tires: Object.values(tireStatusMap)
    };
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (err) {
    next(err);
  }
};