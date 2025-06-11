const db = require("../utils/db");

exports.getProfile = async (req, res) => {
  try {
    const { userId, role } = req.user;

    let query = `
      SELECT u.username, u.role, u.created_at,
        CASE 
          WHEN u.role = 'driver' THEN json_build_object(
            'full_name', dp.full_name,
            'phone', dp.phone,
            'address', dp.address,
            'id_card_number', dp.id_card_number,
            'sim_number', dp.sim_number,
            'license_type', dp.license_type
          )
          WHEN u.role = 'admin' THEN json_build_object(
            'full_name', ap.full_name,
            'phone', ap.phone,
            'email', ap.email,
            'address', ap.address
          )
          WHEN u.role = 'owner' THEN json_build_object(
            'full_name', 'Super Admin',
            'email', 'owner@angkutan.com'
          )
        END as profile
      FROM users u
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      LEFT JOIN admin_profiles ap ON u.id = ap.user_id
      WHERE u.id = $1`;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Failed to get profile",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
