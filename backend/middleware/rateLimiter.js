// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

const { body, validationResult } = require('express-validator');

// ==========================================
// VALIDATION RESULT HANDLER
// ==========================================

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// ==========================================
// AUTH VALIDATIONS
// ==========================================

const validateSignup = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty().withMessage('Full name is required').trim().escape(),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  validate
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const validateForgotPassword = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  validate
];

const validateResetPassword = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate
];

// ==========================================
// PRODUCT VALIDATIONS
// ==========================================

const validateProduct = [
  body('title').notEmpty().withMessage('Product title is required').trim().escape(),
  body('description').notEmpty().withMessage('Product description is required').trim().escape(),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('whatsappLink').notEmpty().withMessage('WhatsApp link is required').isURL().withMessage('Please provide a valid URL'),
  body('isFree').optional().isBoolean(),
  body('isPremium').optional().isBoolean(),
  body('isFeatured').optional().isBoolean(),
  body('isTrending').optional().isBoolean(),
  body('isVisible').optional().isBoolean(),
  validate
];

// ==========================================
// PAYMENT VALIDATIONS
// ==========================================

const validatePayment = [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone().withMessage('Please provide a valid phone number'),
  validate
];

// ==========================================
// ADMIN VALIDATIONS
// ==========================================

const validateAdminLogin = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

module.exports = {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProduct,
  validatePayment,
  validateAdminLogin,
  validate
};
