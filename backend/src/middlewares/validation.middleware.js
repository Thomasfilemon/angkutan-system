// This example uses express-validator, which is highly recommended.
// Run: npm install express-validator
const { body, validationResult } = require("express-validator");

const validateRegistration = [
  body("username")
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long."),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
  body("role")
    .isIn(["admin", "finance", "inventory", "operations", "driver"])
    .withMessage(
      "Role must be one of: admin, finance, inventory, operations, driver."
    ),
  // For non-driver roles, profile fields can be optional.
  // The dashboard will initially just send username/password/role.

  // Custom middleware to handle the validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];

const validateLogin = [
  body("username").notEmpty().withMessage("Username is required."),
  body("password").notEmpty().withMessage("Password is required."),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];

module.exports = {
  validateRegistration,
  validateLogin,
};
