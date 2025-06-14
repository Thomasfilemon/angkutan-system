const { query } = require('../utils/db');

exports.getAllTrips = async (req, res, next) => {
  try {
    const { driver_id, status } = req.query;
    
    let sql = `
      SELECT 
        t.*,
        v.license_plate,
        v.type as vehicle_type,
        v.capacity,
        u.username,
        u.role,
        dp.full_name as driver_name,
        dp.phone as driver_phone
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (driver_id) {
      sql += ` AND t.driver_id = $${++paramCount}`;
      params.push(driver_id);
    }
    
    if (status) {
      sql += ` AND t.status = $${++paramCount}`;
      params.push(status);
    }
    
    sql += ` ORDER BY t.created_at DESC`;
    
    const result = await query(sql, params);
    
    // Transform the data to match expected format
    const trips = result.rows.map(row => ({
      id: row.id,
      driver_id: row.driver_id,
      vehicle_id: row.vehicle_id,
      drop_lat: parseFloat(row.drop_lat),
      drop_lng: parseFloat(row.drop_lng),
      ritase: parseFloat(row.ritase) || 0,
      tarif_per_ritase: parseFloat(row.tarif_per_ritase) || 0,
      total_ritase: parseFloat(row.total_ritase) || 0,
      status: row.status,
      created_at: row.created_at,
      started_at: row.started_at,
      reached_at: row.reached_at,
      returning_at: row.returning_at,
      completed_at: row.completed_at,
      vehicle: {
        id: row.vehicle_id,
        license_plate: row.license_plate,
        type: row.vehicle_type,
        capacity: row.capacity
      },
      driver: {
        id: row.driver_id,
        username: row.username,
        name: row.driver_name,
        phone: row.driver_phone,
        role: row.role
      }
    }));
    
    res.json(trips);
  } catch (err) {
    console.error('Error fetching trips:', err);
    next(err);
  }
};

exports.updateToOTW = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE trips SET status = $1, started_at = $2 WHERE id = $3 RETURNING *',
      ['otw', new Date(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.json({ 
      message: 'Trip status updated to OTW', 
      trip: result.rows[0] 
    });
  } catch (err) {
    console.error('Error updating trip to OTW:', err);
    next(err);
  }
};

exports.updateToReached = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE trips SET status = $1, reached_at = $2 WHERE id = $3 RETURNING *',
      ['perjalanan_pulang', new Date(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.json({ 
      message: 'Trip status updated to perjalanan pulang', 
      trip: result.rows[0] 
    });
  } catch (err) {
    console.error('Error updating trip to reached:', err);
    next(err);
  }
};

exports.completeTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE trips SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      ['selesai', new Date(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.json({ 
      message: 'Trip completed', 
      trip: result.rows[0] 
    });
  } catch (err) {
    console.error('Error completing trip:', err);
    next(err);
  }
};
