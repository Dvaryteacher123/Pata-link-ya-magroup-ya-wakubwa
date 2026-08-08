// ==========================================
// AUTH ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { 
  validateSignup, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword,
  validateChangePassword
} = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Sign up
router.post('/signup', authLimiter, validateSignup, authController.signup);

// Login
router.post('/login', authLimiter, validateLogin, authController.login);

// Google Login
router.post('/google', authLimiter, authController.googleLogin);

// Forgot password
router.post('/forgot-password', authLimiter, validateForgotPassword, authController.forgotPassword);

// Reset password
router.post('/reset-password', authLimiter, validateResetPassword, authController.resetPassword);

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
