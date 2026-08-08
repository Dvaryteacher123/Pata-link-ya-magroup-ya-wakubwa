// ==========================================
// AUTH ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Sign up
router.post('/signup', authController.signup);

// Login
router.post('/login', authController.login);

// Google Login
router.post('/google', authController.googleLogin);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

// Verify email
router.put('/verify/:uid', authController.verifyEmail);

// ==========================================
// PROTECTED ROUTES
// ==========================================

// Change password
router.put('/change-password', verifyToken, authController.changePassword);

// Logout
router.post('/logout', verifyToken, authController.logout);

// Get current user
router.get('/me', verifyToken, authController.getCurrentUser);

// Resend verification email
router.post('/resend-verification', verifyToken, authController.resendVerificationEmail);

module.exports = router;
