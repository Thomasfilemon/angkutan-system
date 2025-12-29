const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, DriverProfile, AdminProfile, sequelize } = require("../models");
const { UniqueConstraintError } = require("sequelize");
const { Expo } = require('expo-server-sdk');

const mobileLogin = async (req, res, next) => {
  try {
    const { username, password, expoPushToken } = req.body;

    // Find the user with associated profiles
    const user = await User.findOne({
      where: {
        username,
        role: { [Op.in]: ["admin", "driver"] },
      },
      include: [
        { model: DriverProfile, as: "driverProfile" },
        { model: AdminProfile, as: "adminProfile" },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Save Expo Push Token to the user table
    if (expoPushToken && Expo.isExpoPushToken(expoPushToken)) {
      await user.update({ expo_push_token: expoPushToken });
    }

    // Prepare response
    const userResponse = user.toJSON();
    userResponse.profile =
      userResponse.driverProfile || userResponse.adminProfile;
    delete userResponse.driverProfile;
    delete userResponse.adminProfile;
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

const webLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      where: {
        username,
        // Allow extended admin-type roles to log into the web dashboard
        role: { [Op.in]: ["owner", "admin", "finance", "inventory", "operations"] }
      },
    });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid credentials or unauthorized role." });
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

      const user = await User.create(
        {
          username,
          password_hash: passwordHash,
          role,
        },
        { transaction: t }
      );

      // Create the corresponding profile based on the role
      if (role === "admin") {
        await AdminProfile.create(
          { ...profileData, user_id: user.id },
          { transaction: t }
        );
      } else if (role === "driver") {
        await DriverProfile.create(
          { ...profileData, user_id: user.id },
          { transaction: t }
        );
      }

      return user;
    });

    const userResponse = newUser.toJSON();
    delete userResponse.password_hash;

    res.status (201).json({
      message: "Registration successful",
      user: userResponse,
    });
  } catch (err) {
    // Provide a more specific error for unique constraints (e.g., username exists)
    if (err instanceof UniqueConstraintError) {
      return res.status(409).json({
        message: "Registration failed",
        details: "Username or other unique field already exists.",
      });
    }
    next(err); // Pass all other errors to the global handler
  }
};

const validateToken = async (req, res) => {
  // Jika middleware verifyToken berhasil, berarti token valid.
  // req.user sudah berisi data user yang terverifikasi.
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      // Tambahkan profil jika diperlukan di frontend
      profile: req.user.driverProfile || req.user.adminProfile || null,
    },
  });
};

const logout = async (req, res) => {
  // Untuk JWT stateless, logout cukup di client (hapus token).
  // Endpoint ini hanya untuk konvensi/kompatibilitas.
  res.json({ message: "Logout successful" });
};

// Export all functions in a single object at the end to prevent crashes.
module.exports = {
  mobileLogin,
  webLogin,
  register,
  validateToken,
  logout,
};
