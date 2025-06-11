const admin = require("../services/firebase");
const db = require("../utils/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const client = await db.connect();

  try {
    const { username, password } = req.body;

    // Get user from database
    const userResult = await client.query(
      `SELECT u.*, 
        CASE 
          WHEN u.role = 'driver' THEN json_build_object(
            'full_name', dp.full_name,
            'phone', dp.phone,
            'address', dp.address
          )
          ELSE json_build_object(
            'full_name', ap.full_name,
            'phone', ap.phone,
            'email', ap.email,
            'address', ap.address
          )
        END as profile
       FROM users u
       LEFT JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN admin_profiles ap ON u.id = ap.user_id
       WHERE u.username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create JWT token
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
  } finally {
    client.release();
  }
};

exports.register = async (req, res) => {
  const client = await db.connect();

  try {
    // Start transaction
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

    // 1. Create Firebase user (only for admin/owner roles)
    let firebaseUser = null;
    if (role !== "driver") {
      firebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });
    }

    // 2. Hash password for local database
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insert into users table
    const userResult = await client.query(
      `INSERT INTO users (username, password_hash, role, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id`,
      [username, passwordHash, role]
    );

    const userId = userResult.rows[0].id;

    // 4. Insert into respective profile table based on role
    if (role === "driver") {
      await client.query(
        `INSERT INTO driver_profiles 
         (user_id, full_name, phone, address, id_card_number, sim_number, license_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, fullName, phone, address, idCardNumber, simNumber, licenseType]
      );
    } else {
      // For admin and owner roles
      await client.query(
        `INSERT INTO admin_profiles 
         (user_id, full_name, phone, email, address) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, fullName, phone, email, address]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    res.status(201).json({
      message: "User registered successfully",
      userId,
      role,
      username,
    });
  } catch (error) {
    // Rollback in case of error
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
