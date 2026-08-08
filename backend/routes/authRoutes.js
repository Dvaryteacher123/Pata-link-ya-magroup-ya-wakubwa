const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { 
  validateSignup, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword 
} = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/forgot-password', authLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, authController.resetPassword);
router.put('/verify/:uid', authController.verifyEmail);

router.put('/change-password', verifyToken, authController.changePassword);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/resend-verification', verifyToken, authController.resendVerificationEmail);

module.exports = router;
