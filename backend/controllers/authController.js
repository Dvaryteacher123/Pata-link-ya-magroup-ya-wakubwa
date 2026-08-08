const { auth, db, collections } = require('../config/firebase');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');
const User = require('../models/User');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');

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
    await User.create(userRecord.uid, userData);
    await EmailService.sendWelcomeEmail({ email, fullName });
    const token = generateToken(userRecord.uid, email);
    res.status(201).json(successResponse({ user: { uid: userRecord.uid, email, fullName }, token }, 'Account created successfully'));
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json(errorResponse(error.message || 'Signup failed'));
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(401).json(errorResponse('Invalid email or password'));
    }
    if (user.status === 'suspended') {
      return res.status(403).json(errorResponse('Account suspended'));
    }
    const token = generateToken(user.uid, email);
    await User.update(user.uid, { lastLogin: new Date().toISOString() });
    res.json(successResponse({ user: { uid: user.uid, email: user.email, role: user.role }, token }, 'Login successful'));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(errorResponse(error.message || 'Login failed'));
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, email, fullName, photoURL } = req.body;
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    let user = await User.getById(uid);
    if (!user) {
      user = await User.create(uid, { uid, email, fullName: fullName || 'Google User', photoURL: photoURL || null, status: 'active', role: 'user', isAdmin: false, emailVerified: true });
    }
    const token = generateToken(uid, email);
    res.json(successResponse({ user: { uid: user.uid, email: user.email }, token }, 'Google login successful'));
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json(errorResponse(error.message || 'Google login failed'));
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }
    const resetToken = generateToken(32);
    await User.update(user.uid, { resetToken });
    await EmailService.sendResetPasswordEmail(email, resetToken, user.fullName);
    res.json(successResponse(null, 'Password reset email sent'));
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed'));
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const snapshot = await db.collection(collections.USERS).where('resetToken', '==', token).limit(1).get();
    if (snapshot.empty) {
      return res.status(400).json(errorResponse('Invalid token'));
    }
    const uid = snapshot.docs[0].id;
    await auth.updateUser(uid, { password });
    await User.update(uid, { resetToken: null });
    res.json(successResponse(null, 'Password reset successful'));
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed'));
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    await auth.updateUser(req.user.uid, { password: newPassword });
    res.json(successResponse(null, 'Password changed successfully'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    await auth.updateUser(req.params.uid, { emailVerified: true });
    await User.update(req.params.uid, { emailVerified: true });
    res.json(successResponse(null, 'Email verified'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

exports.resendVerificationEmail = async (req, res) => {
  res.json(successResponse(null, 'Verification sent'));
};

exports.logout = async (req, res) => {
  res.json(successResponse(null, 'Logout successful'));
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.getById(req.user.uid);
    res.json(successResponse(user, 'User retrieved'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

