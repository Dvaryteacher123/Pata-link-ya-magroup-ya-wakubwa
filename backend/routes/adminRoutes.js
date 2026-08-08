// ==========================================
// ADMIN ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// ==========================================
// ALL ADMIN ROUTES REQUIRE AUTH + ADMIN ROLE
// ==========================================

router.use(verifyToken, isAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Users
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/suspend', adminController.suspendUser);

// Products
router.get('/products', adminController.getAllProducts);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.put('/products/:id/toggle', adminController.toggleProduct);

// Orders
router.get('/orders', adminController.getAllOrders);

// Payments
router.get('/payments', adminController.getAllPayments);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Notifications
router.post('/notifications', adminController.sendNotification);

module.exports = router;
