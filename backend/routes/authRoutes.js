// ==========================================
// AUTH ROUTES
// ==========================================

const express = require('express');
const router = express.Router();
const { 
  signup, 
  login, 
  googleLogin, 
  forgotPassword, 
  resetPassword, 
  changePassword, 
  verifyEmail, 
  resendVerificationEmail, 
  logout, 
  getCurrentUser 
} = require('../controllers/authController');

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
router.post('/signup', authLimiter, validateSignup, signup);

// Login
router.post('/login', authLimiter, validateLogin, login);

// Google Login
router.post('/google', authLimiter, googleLogin);

// Forgot password
router.post('/forgot-password', authLimiter, validateForgotPassword, forgotPassword);

// Reset password
router.post('/reset-password', authLimiter, validateResetPassword, resetPassword);

// Verify email
router.put('/verify/:uid', verifyEmail);

// ==========================================
// PROTECTED ROUTES
// ==========================================

// Change password
router.put('/change-password', verifyToken, changePassword);

// Logout
router.post('/logout', verifyToken, logout);

// Get current user
router.get('/me', verifyToken, getCurrentUser);

// Resend verification email
router.post('/resend-verification', verifyToken, resendVerificationEmail);

module.exports = router;
