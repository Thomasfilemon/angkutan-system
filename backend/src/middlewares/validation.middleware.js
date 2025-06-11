const { body, validationResult } = require("express-validator");

exports.validateLogin = [
  body("username").notEmpty().trim().escape(),
  body("password").notEmpty(),
];

exports.validateRegistration = [
  body("username").notEmpty().trim().isLength({ min: 3 }),
  body("password").isLength({ min: 6 }),
  body("role").isIn(["admin", "driver"]),
  body("fullName").notEmpty().trim(),
  body("phone").notEmpty(),
  body("address").notEmpty(),

  // Conditional validations
  body("email").if(body("role").equals("admin")).isEmail(),
  body("idCardNumber").if(body("role").equals("driver")).notEmpty(),

  // Optional driver fields
  body("simNumber").optional(),
  body("licenseType").optional(),

  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation error",
        details: errors.array(),
      });
    }
    next();
  },
];
