// ==========================================
// AUTH CONTROLLER
// ==========================================

const { auth, db, collections } = require('../config/firebase');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');
const User = require('../models/User');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');

// ==========================================
// SIGN UP
// ==========================================

exports.signup = async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json(errorResponse('Email already registered'));
    }

    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: fullName,
      emailVerified: false
    });

    const userData = {
      uid: userRecord.uid,
      email: email,
      fullName: fullName,
      phone: phone || null,
      status: 'active',
      role: 'user',
      isAdmin: false,
      emailVerified: false
    };

    const newUser = await User.create(userRecord.uid, userData);

    await EmailService.sendWelcomeEmail({
      email: email,
      fullName: fullName
    });

    const token = generateToken(userRecord.uid, email);

    res.status(201).json(successResponse({
      user: {
        uid: userRecord.uid,
        email: email,
        fullName: fullName,
        phone: phone || null
      },
      token: token
    }, 'Account created successfully'));

  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json(errorResponse('Email already registered'));
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json(errorResponse('Invalid email address'));
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json(errorResponse('Password is too weak'));
    }

    res.status(500).json(errorResponse(error.message || 'Signup failed'));
  }
};

// ==========================================
// LOGIN
// ==========================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(401).json(errorResponse('Invalid email or password'));
    }

    if (user.status === 'suspended') {
      return res.status(403).json(errorResponse('Your account has been suspended. Please contact support.'));
    }

    const token = generateToken(user.uid, email);

    await User.update(user.uid, {
      lastLogin: new Date().toISOString()
    });

    await NotificationService.createNotification({
      userId: user.uid,
      title: 'New Login',
      message: 'You have successfully logged in to your account',
      type: 'success',
      target: 'specific'
    });

    res.json(successResponse({
      user: {
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isAdmin: user.isAdmin,
        status: user.status
      },
      token: token
    }, 'Login successful'));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(errorResponse(error.message || 'Login failed'));
  }
};

// ==========================================
// GOOGLE LOGIN
// ==========================================

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, email, fullName, photoURL } = req.body;

    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    let user = await User.getById(uid);

    if (!user) {
      const userData = {
        uid: uid,
        email: email,
        fullName: fullName || 'Google User',
        photoURL: photoURL || null,
        status: 'active',
        role: 'user',
        isAdmin: false,
        emailVerified: true
      };

      user = await User.create(uid, userData);

      await EmailService.sendWelcomeEmail({
        email: email,
        fullName: fullName || 'Google User'
      });
    } else {
      await User.update(uid, {
        lastLogin: new Date().toISOString(),
        photoURL: photoURL || user.photoURL
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json(errorResponse('Your account has been suspended'));
    }

    const token = generateToken(uid, email);

    res.json(successResponse({
      user: {
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        photoURL: user.photoURL,
        role: user.role,
        isAdmin: user.isAdmin
      },
      token: token
    }, 'Google login successful'));

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json(errorResponse(error.message || 'Google login failed'));
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const resetToken = generateToken(32);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    await User.update(user.uid, {
      resetToken: resetToken,
      resetTokenExpiry: resetTokenExpiry.toISOString()
    });

    await EmailService.sendResetPasswordEmail(email, resetToken, user.fullName);

    res.json(successResponse(null, 'Password reset email sent'));

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json(errorResponse(error.message || 'Forgot password failed'));
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const snapshot = await db.collection(collections.USERS)
      .where('resetToken', '==', token)
      .where('resetTokenExpiry', '>=', new Date().toISOString())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(400).json(errorResponse('Invalid or expired reset token'));
    }

    const doc = snapshot.docs[0];
    const uid = doc.id;

    await auth.updateUser(uid, {
      password: password
    });

    await User.update(uid, {
      resetToken: null,
      resetTokenExpiry: null
    });

    await NotificationService.createNotification({
      userId: uid,
      title: 'Password Reset',
      message: 'Your password has been successfully reset',
      type: 'success',
      target: 'specific'
    });

    res.json(successResponse(null, 'Password reset successful'));

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json(errorResponse(error.message || 'Reset password failed'));
  }
};

// ==========================================
// CHANGE PASSWORD
// ==========================================

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user.uid;

    const user = await User.getById(uid);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    await auth.updateUser(uid, {
      password: newPassword
    });

    await NotificationService.createNotification({
      userId: uid,
      title: 'Password Changed',
      message: 'Your password has been successfully changed',
      type: 'info',
      target: 'specific'
    });

    res.json(successResponse(null, 'Password changed successfully'));

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(errorResponse(error.message || 'Change password failed'));
  }
};

// ==========================================
// VERIFY EMAIL
// ==========================================

exports.verifyEmail = async (req, res) => {
  try {
    const { uid } = req.params;

    await auth.updateUser(uid, {
      emailVerified: true
    });

    await User.update(uid, {
      emailVerified: true
    });

    await NotificationService.createNotification({
      userId: uid,
      title: 'Email Verified',
      message: 'Your email has been successfully verified',
      type: 'success',
      target: 'specific'
    });

    res.json(successResponse(null, 'Email verified successfully'));

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json(errorResponse(error.message || 'Email verification failed'));
  }
};

// ==========================================
// RESEND VERIFICATION EMAIL
// ==========================================

exports.resendVerificationEmail = async (req, res) => {
  try {
    const uid = req.user.uid;

    const user = await User.getById(uid);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    if (user.emailVerified) {
      return res.status(400).json(errorResponse('Email already verified'));
    }

    const verifyToken = generateToken(32);
    
    await User.update(uid, {
      verifyToken: verifyToken
    });

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}&uid=${uid}`;
    
    console.log('Verification link:', verifyLink);

    res.json(successResponse(null, 'Verification email sent'));

  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to resend verification email'));
  }
};

// ==========================================
// LOGOUT
// ==========================================

exports.logout = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (uid) {
      await NotificationService.createNotification({
        userId: uid,
        title: 'Logged Out',
        message: 'You have been successfully logged out',
        type: 'info',
        target: 'specific'
      });
    }

    res.json(successResponse(null, 'Logout successful'));

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(errorResponse(error.message || 'Logout failed'));
  }
};

// ==========================================
// GET CURRENT USER
// ==========================================

exports.getCurrentUser = async (req, res) => {
  try {
    const uid = req.user.uid;

    const user = await User.getById(uid);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    res.json(successResponse({
      uid: user.uid,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isAdmin: user.isAdmin,
      status: user.status,
      emailVerified: user.emailVerified,
      photoURL: user.photoURL
    }, 'User retrieved successfully'));

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get user'));
  }
};

