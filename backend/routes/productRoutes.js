// ==========================================
// PRODUCT ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { validateProduct, validateProductUpdate } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { apiLimiter } = require('../middleware/rateLimiter');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Get all products
router.get('/', apiLimiter, productController.getAllProducts);

// Get product by ID
router.get('/:id', apiLimiter, productController.getProductById);

// ==========================================
// ADMIN ROUTES (Require authentication + admin role)
// ==========================================

// Create product
router.post('/', verifyToken, isAdmin, validateProduct, productController.createProduct);

// Update product
router.put('/:id', verifyToken, isAdmin, validateProductUpdate, productController.updateProduct);

// Delete product
router.delete('/:id', verifyToken, isAdmin, productController.deleteProduct);

// Toggle product visibility
router.put('/:id/toggle', verifyToken, isAdmin, productController.toggleVisibility);

module.exports = router;

