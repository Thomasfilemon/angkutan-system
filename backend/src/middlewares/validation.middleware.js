const { body } = require("express-validator");

exports.validateRegistration = [
  // Common fields
  body("username").isLength({ min: 3 }).trim().escape(),
  body("password").isLength({ min: 6 }),
  body("role").isIn(["owner", "admin", "driver"]),
  body("fullName").notEmpty(),
  body("phone").notEmpty(),
  body("address").optional(),

  // Conditional validation
  body("email")
    .if(body("role").not().equals("driver"))
    .isEmail()
    .normalizeEmail(),

  // Driver-specific fields
  body("idCardNumber").if(body("role").equals("driver")).notEmpty(),
  body("simNumber").if(body("role").equals("driver")).optional(),
  body("licenseType").if(body("role").equals("driver")).optional(),
];
