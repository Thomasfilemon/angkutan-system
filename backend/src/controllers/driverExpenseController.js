const { query } = require('../utils/db');

// Get all expenses with optional filtering
exports.getExpenses = async (req, res, next) => {
  try {
    // Test database connection first
    await query('SELECT 1');
    
    const { trip_id, driver_id } = req.query;
    
    // Validate input parameters
    if (trip_id && (isNaN(parseInt(trip_id)) || parseInt(trip_id) <= 0)) {
      return res.status(400).json({ 
        error: 'Invalid trip_id parameter',
        message: 'trip_id must be a positive integer'
      });
    }
    
    if (driver_id && (isNaN(parseInt(driver_id)) || parseInt(driver_id) <= 0)) {
      return res.status(400).json({ 
        error: 'Invalid driver_id parameter',
        message: 'driver_id must be a positive integer'
      });
    }
    
    let sql = `
      SELECT 
        de.id,
        de.trip_id,
        de.driver_id,
        de.jenis,
        de.amount,
        de.receipt_url,
        de.created_at,
        t.status as trip_status,
        t.drop_lat,
        t.drop_lng,
        t.ritase,
        t.tarif_per_ritase,
        v.license_plate,
        v.type as vehicle_type,
        u.username,
        dp.full_name as driver_name
      FROM driver_expenses de
      LEFT JOIN trips t ON de.trip_id = t.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN users u ON de.driver_id = u.id
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (trip_id) {
      sql += ` AND de.trip_id = $${++paramCount}`;
      params.push(parseInt(trip_id));
    }

    if (driver_id) {
      sql += ` AND de.driver_id = $${++paramCount}`;
      params.push(parseInt(driver_id));
    }

    sql += ` ORDER BY de.created_at DESC`;

    console.log('Executing SQL:', sql);
    console.log('With parameters:', params);

    const result = await query(sql, params);
    
    if (!result || !result.rows) {
      console.error('Invalid query result:', result);
      return res.status(500).json({ 
        error: 'Database query returned invalid result' 
      });
    }
    
    // Transform the data to match expected format
    const expenses = result.rows.map(row => {
      try {
        return {
          id: row.id,
          trip_id: row.trip_id,
          driver_id: row.driver_id,
          jenis: row.jenis || '',
          amount: row.amount ? parseFloat(row.amount) : 0,
          receipt_url: row.receipt_url || null,
          created_at: row.created_at,
          trip: row.trip_id ? {
            id: row.trip_id,
            status: row.trip_status || 'unknown',
            drop_lat: row.drop_lat ? parseFloat(row.drop_lat) : null,
            drop_lng: row.drop_lng ? parseFloat(row.drop_lng) : null,
            ritase: row.ritase ? parseFloat(row.ritase) : 0,
            tarif_per_ritase: row.tarif_per_ritase ? parseFloat(row.tarif_per_ritase) : 0,
            vehicle: {
              license_plate: row.license_plate || 'N/A',
              type: row.vehicle_type || 'unknown'
            }
          } : null,
          driver: {
            id: row.driver_id,
            username: row.username || 'unknown',
            name: row.driver_name || 'N/A'
          }
        };
      } catch (mappingError) {
        console.error('Error mapping row:', mappingError, 'Row data:', row);
        throw new Error(`Data mapping failed for expense ID: ${row.id}`);
      }
    });
    
    console.log(`Successfully fetched ${expenses.length} expenses`);
    res.json(expenses);
    
  } catch (err) {
    console.error('Detailed error in getExpenses:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    
    // Handle specific database errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: 'Database connection failed',
        message: 'Unable to connect to database'
      });
    }
    
    if (err.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ 
        error: 'Database schema error',
        message: 'Required table does not exist'
      });
    }
    
    if (err.code === '42703') { // Column doesn't exist
      return res.status(500).json({ 
        error: 'Database schema error',
        message: 'Required column does not exist'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
};

// Create a new expense
exports.createExpense = async (req, res, next) => {
  try {
    // Test database connection
    await query('SELECT 1');
    
    const { trip_id, driver_id, jenis, amount } = req.body;
    const receipt_url = req.file ? req.file.path : null;

    // Validate required fields
    if (!trip_id || !driver_id || !jenis || amount === undefined || amount === null) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'trip_id, driver_id, jenis, and amount are required',
        received: { trip_id, driver_id, jenis, amount }
      });
    }

    // Validate data types
    if (isNaN(parseInt(trip_id)) || parseInt(trip_id) <= 0) {
      return res.status(400).json({ 
        error: 'Invalid trip_id',
        message: 'trip_id must be a positive integer'
      });
    }

    if (isNaN(parseInt(driver_id)) || parseInt(driver_id) <= 0) {
      return res.status(400).json({ 
        error: 'Invalid driver_id',
        message: 'driver_id must be a positive integer'
      });
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        message: 'amount must be a non-negative number'
      });
    }

    if (typeof jenis !== 'string' || jenis.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid jenis',
        message: 'jenis must be a non-empty string'
      });
    }

    const sql = `
      INSERT INTO driver_expenses (trip_id, driver_id, jenis, amount, receipt_url, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW()) 
      RETURNING *
    `;
    
    const params = [
      parseInt(trip_id), 
      parseInt(driver_id), 
      jenis.trim(), 
      parseFloat(amount), 
      receipt_url
    ];

    console.log('Creating expense with SQL:', sql);
    console.log('Parameters:', params);

    const result = await query(sql, params);
    
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('Insert failed - no rows returned');
      return res.status(500).json({ 
        error: 'Failed to create expense',
        message: 'Database insert operation failed'
      });
    }
    
    // FIX: Access first row correctly
    const expense = {
      id: result.rows[0].id,
      trip_id: result.rows[0].trip_id,
      driver_id: result.rows[0].driver_id,
      jenis: result.rows[0].jenis,
      amount: parseFloat(result.rows[0].amount),
      receipt_url: result.rows[0].receipt_url,
      created_at: result.rows[0].created_at
    };
    
    console.log('Successfully created expense:', expense.id);
    res.status(201).json(expense);
    
  } catch (err) {
    console.error('Detailed error in createExpense:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });
    
    // Handle specific database errors
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({ 
        error: 'Invalid reference',
        message: 'Referenced trip_id or driver_id does not exist'
      });
    }
    
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ 
        error: 'Duplicate entry',
        message: 'Expense with these details already exists'
      });
    }
    
    if (err.code === '23514') { // Check constraint violation
      return res.status(400).json({ 
        error: 'Invalid data',
        message: 'Data violates database constraints'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Failed to create expense'
    });
  }
};

// Update an existing expense
exports.updateExpense = async (req, res, next) => {
  try {
    await query('SELECT 1');
    
    const { id } = req.params;
    const { jenis, amount } = req.body;
    const receipt_url = req.file ? req.file.path : null;

    // Validate expense ID
    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return res.status(400).json({ 
        error: 'Invalid expense ID',
        message: 'ID must be a positive integer'
      });
    }

    // Check if expense exists
    const checkResult = await query('SELECT id FROM driver_expenses WHERE id = $1', [parseInt(id)]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Expense not found',
        message: `No expense found with ID: ${id}`
      });
    }

    let sql = 'UPDATE driver_expenses SET ';
    const params = [];
    const updates = [];
    let paramCount = 0;

    if (jenis !== undefined) {
      if (typeof jenis !== 'string' || jenis.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Invalid jenis',
          message: 'jenis must be a non-empty string'
        });
      }
      updates.push(`jenis = $${++paramCount}`);
      params.push(jenis.trim());
    }

    if (amount !== undefined) {
      if (isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
        return res.status(400).json({ 
          error: 'Invalid amount',
          message: 'amount must be a non-negative number'
        });
      }
      updates.push(`amount = $${++paramCount}`);
      params.push(parseFloat(amount));
    }

    if (receipt_url !== null) {
      updates.push(`receipt_url = $${++paramCount}`);
      params.push(receipt_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sql += updates.join(', ');
    sql += ` WHERE id = $${++paramCount} RETURNING *`;
    params.push(parseInt(id));

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // FIX: Return first row correctly
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Failed to update expense'
    });
  }
};

// Delete an expense
exports.deleteExpense = async (req, res, next) => {
  try {
    await query('SELECT 1');
    
    const { id } = req.params;

    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const result = await query(
      'DELETE FROM driver_expenses WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // FIX: Return first row correctly
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Failed to delete expense'
    });
  }
};

// Get a single expense by ID
exports.getExpenseById = async (req, res, next) => {
  try {
    await query('SELECT 1');
    
    const { id } = req.params;

    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const sql = `
      SELECT 
        de.*,
        t.status as trip_status,
        t.drop_lat,
        t.drop_lng,
        t.ritase,
        t.tarif_per_ritase,
        v.license_plate,
        v.type as vehicle_type,
        u.username,
        dp.full_name as driver_name
      FROM driver_expenses de
      LEFT JOIN trips t ON de.trip_id = t.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN users u ON de.driver_id = u.id
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE de.id = $1
    `;

    const result = await query(sql, [parseInt(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // FIX: Access first row correctly
    const row = result.rows[0];
    const expense = {
      id: row.id,
      trip_id: row.trip_id,
      driver_id: row.driver_id,
      jenis: row.jenis || '',
      amount: row.amount ? parseFloat(row.amount) : 0,
      receipt_url: row.receipt_url || null,
      created_at: row.created_at,
      trip: row.trip_id ? {
        id: row.trip_id,
        status: row.trip_status || 'unknown',
        drop_lat: row.drop_lat ? parseFloat(row.drop_lat) : null,
        drop_lng: row.drop_lng ? parseFloat(row.drop_lng) : null,
        ritase: row.ritase ? parseFloat(row.ritase) : 0,
        tarif_per_ritase: row.tarif_per_ritase ? parseFloat(row.tarif_per_ritase) : 0,
        vehicle: {
          license_plate: row.license_plate || 'N/A',
          type: row.vehicle_type || 'unknown'
        }
      } : null,
      driver: {
        id: row.driver_id,
        username: row.username || 'unknown',
        name: row.driver_name || 'N/A'
      }
    };

    res.json(expense);
  } catch (err) {
    console.error('Error fetching expense by ID:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Failed to fetch expense'
    });
  }
};

module.exports = exports;
