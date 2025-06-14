const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, DriverProfile, AdminProfile, sequelize } = require('../models');
const { UniqueConstraintError } = require('sequelize');

const mobileLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find the user using Sequelize models, including their associated profile
    const user = await User.findOne({
      where: { username, role: ['admin', 'driver'] },
      include: [
        // These 'as' aliases must match the ones defined in your models/index.js associations
        { model: DriverProfile, as: 'driverProfile' },
        { model: AdminProfile, as: 'adminProfile' }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials or unauthorized role." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Create JWT token with a consistent payload
    const token = jwt.sign(
      { id: user.id, role: user.role }, // Use 'id' to match your verifyToken middleware
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    // Structure the user object for the response, combining profiles for simplicity
    const userResponse = user.toJSON();
    userResponse.profile = userResponse.driverProfile || userResponse.adminProfile;
    delete userResponse.driverProfile;
    delete userResponse.adminProfile;
    delete userResponse.password_hash; // Never send the hash to the client

    res.json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    next(err); // Pass all errors to your global error handler
  }
};

const webLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      where: { username, role: 'owner' }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials or unauthorized role." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    
    const userResponse = user.toJSON();
    delete userResponse.password_hash;

    res.json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    // Separate user data from profile data using destructuring
    const { username, password, role, ...profileData } = req.body;

    // Use a managed transaction for safety; it automatically handles COMMIT and ROLLBACK.
    const newUser = await sequelize.transaction(async (t) => {
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await User.create({
        username,
        password_hash: passwordHash,
        role,
      }, { transaction: t });

      // Create the corresponding profile based on the role
      if (role === 'admin') {
        await AdminProfile.create({ ...profileData, user_id: user.id }, { transaction: t });
      } else if (role === 'driver') {
        await DriverProfile.create({ ...profileData, user_id: user.id }, { transaction: t });
      }

      return user;
    });
    
    const userResponse = newUser.toJSON();
    delete userResponse.password_hash;

    res.status(201).json({
      message: "Registration successful",
      user: userResponse,
    });
  } catch (err) {
    // Provide a more specific error for unique constraints (e.g., username exists)
    if (err instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'Registration failed', details: 'Username or other unique field already exists.' });
    }
    next(err); // Pass all other errors to the global handler
  }
};

// Export all functions in a single object at the end to prevent crashes.
module.exports = {
  mobileLogin,
  webLogin,
  register,
};
