const admin = require("../services/firebase");
const db = require("../utils/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Mobile app login (for admins and drivers)
exports.mobileLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user from database (only admin and driver roles)
    const result = await db.query(
      `SELECT u.*, 
        CASE 
          WHEN u.role = 'driver' THEN json_build_object(
            'full_name', dp.full_name,
            'phone', dp.phone,
            'address', dp.address
          )
          WHEN u.role = 'admin' THEN json_build_object(
            'full_name', ap.full_name,
            'phone', ap.phone,
            'email', ap.email,
            'address', ap.address
          )
        END as profile
       FROM users u
       LEFT JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN admin_profiles ap ON u.id = ap.user_id
       WHERE u.username = $1 AND u.role IN ('admin', 'driver')`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token for mobile users
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Web login (only for owner)
exports.webLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user from database (only owner role)
    const result = await db.query(
      `SELECT u.* FROM users u WHERE u.username = $1 AND u.role = 'owner'`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token for web user
    const token = jwt.sign(
      {
        userId: user.id,
        role: "owner",
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: "owner",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.register = async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const {
      username,
      password,
      role,
      fullName,
      phone,
      email,
      address,
      idCardNumber,
      simNumber,
      licenseType,
    } = req.body;

    // Check if username already exists
    const userExists = await client.query(
      "SELECT username FROM users WHERE username = $1",
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        error: "Registration failed",
        details: "Username already exists",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users (username, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [username, passwordHash, role]
    );

    const userId = userResult.rows[0].id;

    // Insert profile based on role
    if (role === "admin") {
      await client.query(
        `INSERT INTO admin_profiles 
         (user_id, full_name, phone, email, address) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, fullName, phone, email, address]
      );
    } else if (role === "driver") {
      await client.query(
        `INSERT INTO driver_profiles 
         (user_id, full_name, phone, address, id_card_number, sim_number, license_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, fullName, phone, address, idCardNumber, simNumber, licenseType]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: userId,
        username,
        role,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};
