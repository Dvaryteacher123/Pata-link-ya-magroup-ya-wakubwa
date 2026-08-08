// ==========================================
// PAYMENT ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validatePayment } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { paymentLimiter, webhookLimiter } = require('../middleware/rateLimiter');

// ==========================================
// WEBHOOK ROUTE (Public - HarakaPay calls this)
// ==========================================

router.post('/webhook', webhookLimiter, paymentController.paymentWebhook);

// ==========================================
// PROTECTED ROUTES (Require authentication)
// ==========================================

// Initiate payment
router.post('/initiate', verifyToken, paymentLimiter, validatePayment, paymentController.initiatePayment);

// Check payment status
router.get('/status/:orderId', verifyToken, paymentController.checkPaymentStatus);

// Get payment history
router.get('/history', verifyToken, paymentController.getPaymentHistory);

// ==========================================
// ADMIN ROUTES (Require authentication + admin role)
// ==========================================

// Get payment stats
router.get('/stats', verifyToken, isAdmin, paymentController.getPaymentStats);

module.exports = router;
