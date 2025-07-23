// src/controllers/web/tireController.js
const { Vehicle, VehicleTire, TireInventory, TireInspection, TireInstance } = require('../../models');
const { Op } = require('sequelize');

// Update tire data (pressure, temperature, etc.)
exports.updateTireData = async (req, res, next) => {
  try {
    const { tireId } = req.params; // This is VehicleTire ID
    const { current_pressure, mileage_installed, tread_depth, condition, notes } = req.body;
    
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
      mileage_installed: mileage_installed ?? tire.mileage_installed,  // ← Add this line
      tread_depth: tread_depth ?? tire.tread_depth,
      condition: condition ?? tire.condition,
      notes: notes ?? tire.notes
    });
    
    if (mileage_installed !== undefined) {
      await VehicleTire.update(
        { mileage_installed: mileage_installed },
        {
          where: {
            tire_instance_id: tire.tire_instance_id,
            status: 'removed'
          }
        }
      );
      console.log(`Updated mileage_installed to ${mileage_installed} for removed records of tire instance ${tire.tire_instance_id}`);
    }

    // Create inspection record for history
    await TireInspection.create({
      vehicle_tire_id: tire.id,
      tire_instance_id: tire.tire_instance_id,
      inspection_date: new Date(),
      tread_depth: tread_depth ?? tire.tread_depth,
      air_pressure: current_pressure ?? tire.current_pressure,
      temperature: 25.0, // ✅ Set default temperature for inspection record
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

// Remove tire from vehicle
exports.removeTire = async (req, res, next) => {
  try {
    const { tireId } = req.params;
    const { reason, notes } = req.body;

    const vehicleTire = await VehicleTire.findByPk(tireId, {
      include: [
        {
          model: TireInstance,
          as: 'tireInstance'
        },
        {
          model: TireInspection,
          as: 'inspections',
          order: [['inspection_date', 'DESC']],
          limit: 3
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

    const vehicle = await Vehicle.findByPk(vehicleTire.vehicle_id);

    // ✅ SMART NOTES MANAGEMENT
    const smartNotesManager = (existingNotes) => {
      if (!existingNotes) return '';
      
      const lines = existingNotes.split('\n\n');
      const installLines = lines.filter(line => line.includes('Dipasang:'));
      const removeLines = lines.filter(line => line.includes('Dilepas:'));
      const otherLines = lines.filter(line => 
        !line.includes('Dipasang:') && 
        !line.includes('Dilepas:') && 
        line.trim().length > 0
      );

      // Keep only meaningful notes and summarize history
      const meaningfulNotes = [];
      
      // Keep user notes
      if (otherLines.length > 0) {
        meaningfulNotes.push(...otherLines.slice(-2)); // Keep last 2 user notes
      }
      
      // Summarize installation history
      if (installLines.length > 0 || removeLines.length > 0) {
        const totalCycles = Math.max(installLines.length, removeLines.length);
        if (totalCycles > 1) {
          meaningfulNotes.push(`[Riwayat: ${totalCycles} kali pemasangan]`);
        }
        
        // Keep only the last installation info
        if (installLines.length > 0) {
          meaningfulNotes.push(installLines[installLines.length - 1]);
        }
      }

      return meaningfulNotes.join('\n\n');
    };

    // Get inspection notes
    const inspectionNotes = [];
    if (vehicleTire.inspections) {
      vehicleTire.inspections.forEach(inspection => {
        if (inspection.notes &&
            !inspection.notes.startsWith('Inspection:') &&
            !inspection.notes.includes('Removed from vehicle') &&
            !inspection.notes.includes('Installed on') &&
            inspection.notes.trim().length > 0) {
          inspectionNotes.push(`${new Date(inspection.inspection_date).toLocaleDateString('id-ID')}: ${inspection.notes.trim()}`);
        }
      });
    }

    // Process existing notes
    const processedNotes = smartNotesManager(vehicleTire.notes);
    
    // Add current removal info
    const removalInfo = `Dilepas: ${new Date().toLocaleDateString('id-ID')}${reason && reason !== 'Manual removal' ? ` (${reason})` : ''}${notes ? ` - ${notes}` : ''}`;
    
    // Combine smartly
    const finalNotes = [
      ...inspectionNotes.slice(-1), // Keep only last inspection note
      processedNotes,
      removalInfo
    ].filter(note => note.trim().length > 0).join('\n\n');

    // Update vehicle tire status to removed
    await vehicleTire.update({
      status: 'removed',
      remove_date: new Date(),
      mileage_removed: vehicle.current_mileage || 0,  // ✅ Add this line
      notes: finalNotes
    });

    // Update tire instance
    if (vehicleTire.tireInstance) {
      await vehicleTire.tireInstance.update({
        status: 'removed',
        condition: vehicleTire.condition,
        current_tread_depth: vehicleTire.tread_depth,
        notes: finalNotes
      });
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
    const { tire_inventory_id, serial_numbers, purchase_price, purchase_date, condition } = req.body; // ✅ Added condition

    // --- VALIDATION ---
    if (!tire_inventory_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tire inventory ID and a non-empty array of serial numbers are required.'
      });
    }

    const inventory = await TireInventory.findByPk(tire_inventory_id);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Tire inventory not found'
      });
    }

    // Check for duplicate serial numbers in the database
    const existingInstances = await TireInstance.findAll({
      where: {
        tire_serial_number: {
          [Op.in]: serial_numbers
        }
      }
    });

    if (existingInstances.length > 0) {
      const existingSerials = existingInstances.map(inst => inst.tire_serial_number).join(', ');
      return res.status(409).json({
        success: false,
        message: `One or more serial numbers already exist: ${existingSerials}`
      });
    }

    // --- CREATION ---
    const instancesToCreate = serial_numbers.map(serial => ({
      tire_inventory_id,
      tire_serial_number: serial,
      purchase_date: purchase_date || new Date(),
      purchase_price: purchase_price || inventory.unit_price,
      condition: condition || 'new', // ✅ Use provided condition or default to 'new'
      status: 'in_stock'
    }));

    const createdInstances = await TireInstance.bulkCreate(instancesToCreate);

    // Update inventory stock by the number of instances created
    await inventory.increment('current_stock', { by: serial_numbers.length });

    res.status(201).json({
      success: true,
      message: `${serial_numbers.length} tire instances created successfully`,
      data: createdInstances
    });

  } catch (err) {
    // Handle potential unique constraint errors during bulkCreate
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'One or more serial numbers already exist. Please provide unique serial numbers.',
        details: err.errors.map(e => e.message)
      });
    }

    next(err);
  }
};

// Get available tire instances for installation. Can be filtered by status.
exports.getAvailableTireInstances = async (req, res, next) => {
  try {
    const { tire_inventory_id, status } = req.query;
    
    let whereClause = {
      condition: { [Op.in]: ['new', 'good', 'fair', 'poor', 'damaged', 'disposed', 'replace', 'meledak', 'bocor', 'kampasa'] } // Only usable tires
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
          // FIX: Added 'id' and 'vehicle_id' to the attributes list
          attributes: ['id', 'vehicle_id', 'remove_date', 'install_date', 'mileage_installed', 'mileage_removed'],
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

    // ✅ ADD CONDITION CHECK - Only allow fair or good tires
    if (!['fair', 'good', 'new'].includes(tireInstance.condition)) {
      return res.status(400).json({
        success: false,
        message: `Ban tidak dapat dipasang. Kondisi ban: ${tireInstance.condition}. Hanya ban dengan kondisi 'Baik', 'Cukup', atau 'Baru' yang dapat dipasang.`
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

    // ✅ Store original status before updating (fixes inventory bug)
    const originalStatus = tireInstance.status;

    // ✅ DETERMINE CORRECT MILEAGE_INSTALLED VALUE
    let baseMileage = mileage_installed || vehicle.current_mileage || 0;

    if (tireInstance.status === 'removed') {
      const lastRemoval = await VehicleTire.findOne({
        where: {
          tire_instance_id: tire_instance_id,
          status: 'removed',
          mileage_removed: { [Op.not]: null }
        },
        order: [['remove_date', 'DESC']],
        limit: 1
      });
      
      if (lastRemoval?.mileage_removed) {
        baseMileage = lastRemoval.mileage_removed;
        console.log(`Using previous removal mileage: ${baseMileage} for tire ${tireInstance.tire_serial_number}`);
      } else {
        console.log(`No removal mileage found, using default: ${baseMileage} for tire ${tireInstance.tire_serial_number}`);
      }
    } else {
      console.log(`New tire installation, using mileage: ${baseMileage} for tire ${tireInstance.tire_serial_number}`);
    }

    // ✅ Preserve notes from tire instance when creating vehicle tire
    const installationNote = `Dipasang: ${new Date().toLocaleDateString('id-ID')} di ${vehicle.license_plate} posisi ${position}`;
    const preservedNotes = tireInstance.notes ? 
      `${tireInstance.notes}\n\n${installationNote}` : 
      installationNote;

    // Create vehicle tire installation record
    const vehicleTire = await VehicleTire.create({
      vehicle_id: vehicleId,
      tire_inventory_id: tireInstance.tire_inventory_id,
      tire_instance_id: tire_instance_id,
      position,
      install_date: new Date(),
      mileage_installed: baseMileage, // ✅ Use accumulated mileage
      recommended_pressure: recommended_pressure || 35,
      current_pressure: recommended_pressure || 35,
      tread_depth: tireInstance.current_tread_depth,
      temperature: 25.0,
      condition: (tireInstance.condition === 'new') ? 'good' : tireInstance.condition,
      status: 'active',
      notes: preservedNotes
    });

    // Update tire instance status to 'installed'
    await tireInstance.update({
      status: 'installed',
    });

    // ✅ Fix: Use original status for inventory decrement
    if(originalStatus === 'in_stock'){
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
            mileage_installed: tire.mileage_installed, // ✅ Add this line
            updated_at: tire.updated_at, // Added update date
            brand: tireInfo.tire_brand,
            size: tireInfo.tire_size,
            notes: tire.notes, // ← ADD THIS LINE
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
exports.getInventoryTireInstances = async (req, res, next) => {
  try {
    const instances = await TireInstance.findAll({
      where: {
        status: 'in_stock' // We only want tires that are in stock for this inventory page
      },
      include: [
        {
          model: TireInventory,
          as: 'tireInventory',
          attributes: ['tire_brand', 'tire_size', 'tire_type']
        },
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: instances
    });
  } catch (err) {
    next(err);
  }
};

// Edit tire instance condition and notes
exports.editTireInstance = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { condition, notes } = req.body;

    const tireInstance = await TireInstance.findByPk(instanceId);
    if (!tireInstance) {
      return res.status(404).json({
        success: false,
        message: 'Tire instance not found'
      });
    }

    // Validate condition
    const validConditions = ['new', 'good', 'fair', 'poor', 'damaged', 'disposed', 'replace', 'meledak', 'bocor', 'kampasa'];
    if (condition && !validConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tire condition'
      });
    }

    // Update tire instance
    await tireInstance.update({
      condition: condition || tireInstance.condition,
      notes: notes !== undefined ? notes : tireInstance.notes
    });

    res.json({
      success: true,
      message: 'Tire instance updated successfully',
      data: tireInstance
    });

  } catch (err) {
    next(err);
  }
};

exports.deleteTireInstance = async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    const tireInstance = await TireInstance.findByPk(instanceId);
    if (!tireInstance) {
      return res.status(404).json({
        success: false,
        message: 'Tire instance not found'
      });
    }

    // Check if tire is currently installed
    if (tireInstance.status === 'installed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tire that is currently installed on a vehicle'
      });
    }

    // Get inventory to update stock
    const inventory = await TireInventory.findByPk(tireInstance.tire_inventory_id);
    
    // Delete the tire instance
    await tireInstance.destroy();

    // Update inventory stock only if tire was in stock
    if (inventory && tireInstance.status === 'in_stock') {
      await inventory.decrement('current_stock', { by: 1 });
    }

    res.json({
      success: true,
      message: 'Tire instance deleted successfully'
    });

  } catch (err) {
    next(err);
  }
};
