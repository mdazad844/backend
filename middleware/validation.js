// Input Validation Middleware
const { validationResult, body, param, query } = require('express-validator');

// Validation error formatter
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

// Payment validation rules
const validatePayment = [
  body('amount')
    .isInt({ min: 100 }) // Minimum ₹1 (100 paise)
    .withMessage('Amount must be at least ₹1'),
  
  body('currency')
    .isIn(['INR'])
    .withMessage('Currency must be INR'),
  
  body('receipt')
    .notEmpty()
    .withMessage('Receipt ID is required'),
  
  handleValidationErrors
];

// Order validation rules
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for all items'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('shippingAddress.line1')
    .notEmpty()
    .withMessage('Address line 1 is required'),
  
  body('shippingAddress.city')
    .notEmpty()
    .withMessage('City is required'),
  
  body('shippingAddress.pincode')
    .isPostalCode('IN')
    .withMessage('Valid Indian pincode is required'),
  
  handleValidationErrors
];

// Product validation rules
const validateProduct = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2-100 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  
  body('inventory.quantity')
    .isInt({ min: 0 })
    .withMessage('Inventory quantity must be 0 or more'),
  
  handleValidationErrors
];

// User validation rules
const validateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('profile.name')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2-50 characters'),
  
  body('profile.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  
  handleValidationErrors
];

// Address validation rules
const validateAddress = [
  body('line1')
    .notEmpty()
    .trim()
    .withMessage('Address line 1 is required'),
  
  body('city')
    .notEmpty()
    .trim()
    .withMessage('City is required'),
  
  body('state')
    .notEmpty()
    .trim()
    .withMessage('State is required'),
  
  body('pincode')
    .isPostalCode('IN')
    .withMessage('Valid Indian pincode is required'),
  
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .isMongoId()
    .withMessage('Valid ID is required'),
  
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  
  handleValidationErrors
];

module.exports = {
  validatePayment,
  validateOrder,
  validateProduct,
  validateUser,
  validateAddress,
  validateId,
  validatePagination,
  handleValidationErrors
};