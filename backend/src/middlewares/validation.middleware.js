// This example uses express-validator, which is highly recommended.
// Run: npm install express-validator
const { body, validationResult } = require('express-validator');

// --- THIS IS THE FIX ---
// Define your validation rules as an ARRAY. This is why it's an 'object'.
const validateRegistration = [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  body('role').isIn(['admin', 'driver']).withMessage('Role must be either admin or driver.'),
  body('fullName').notEmpty().withMessage('Full name is required.'),
  body('phone').isMobilePhone('id-ID').withMessage('A valid Indonesian phone number is required.'),
  
  // Custom middleware to handle the validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];

module.exports = {
  validateRegistration,
  validateLogin,
};
