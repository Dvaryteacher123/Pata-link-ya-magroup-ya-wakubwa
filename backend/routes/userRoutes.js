// ==========================================
// USER ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// ==========================================
// ALL USER ROUTES REQUIRE AUTHENTICATION
// ==========================================

router.use(verifyToken);

// Profile
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// Orders
router.get('/orders', userController.getUserOrders);

// Payments
router.get('/payments', userController.getUserPayments);

// Links (Purchased WhatsApp links)
router.get('/links', userController.getPurchasedLinks);

// Notifications
router.get('/notifications', userController.getNotifications);
router.put('/notifications/:id/read', userController.markNotificationRead);
router.put('/notifications/read-all', userController.markAllNotificationsRead);

// Support
router.post('/support', userController.contactSupport);

// Account
router.delete('/account', userController.deleteAccount);

module.exports = router;
