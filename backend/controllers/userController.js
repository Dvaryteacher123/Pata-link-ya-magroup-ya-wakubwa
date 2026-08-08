// ==========================================
// USER CONTROLLER
// ==========================================

const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const NotificationService = require('../services/notificationService');
const EmailService = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/helpers');

// ==========================================
// GET USER PROFILE
// ==========================================

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.getById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    res.json(successResponse({
      user: {
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        phone: user.phone,
        role: user.role,
        isAdmin: user.isAdmin,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    }, 'Profile retrieved successfully'));

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get profile'));
  }
};

// ==========================================
// UPDATE USER PROFILE
// ==========================================

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { fullName, displayName, phone, bio } = req.body;

    const user = await User.getById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (displayName) updateData.displayName = displayName;
    if (phone) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;

    const updatedUser = await User.update(userId, updateData);

    res.json(successResponse({
      user: {
        uid: updatedUser.uid,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        displayName: updatedUser.displayName,
        phone: updatedUser.phone,
        bio: updatedUser.bio
      }
    }, 'Profile updated successfully'));

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

// ==========================================
// GET USER ORDERS
// ==========================================

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 20, status } = req.query;

    let orders = await Order.getByUserId(userId, parseInt(limit) * parseInt(page));

    if (status) {
      orders = orders.filter(o => o.paymentStatus === status);
    }

    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const product = await Product.getById(order.productId);
      return {
        orderId: order.orderId,
        productTitle: order.productTitle,
        amount: order.amount,
        status: order.paymentStatus,
        orderDate: order.createdAt,
        completedAt: order.completedAt,
        whatsappLink: order.paymentStatus === 'completed' ? order.whatsappLink : null,
        isFree: order.isFree,
        isPremium: order.isPremium
      };
    }));

    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = ordersWithDetails.slice(start, start + parseInt(limit));

    res.json(successResponse({
      orders: paginatedOrders,
      total: orders.length,
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Orders retrieved successfully'));

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get orders'));
  }
};

// ==========================================
// GET USER PAYMENTS
// ==========================================

exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 20, status } = req.query;

    let payments = await Payment.getByUserId(userId, parseInt(limit) * parseInt(page));

    if (status) {
      payments = payments.filter(p => p.status === status);
    }

    const paymentsWithDetails = await Promise.all(payments.map(async (payment) => {
      const order = await Order.getById(payment.orderId);
      return {
        paymentId: payment.paymentId,
        orderId: order?.orderId || null,
        productTitle: order?.productTitle || 'Unknown',
        amount: payment.amount,
        status: payment.status,
        phone: payment.phone,
        completedAt: payment.completedAt,
        createdAt: payment.createdAt
      };
    }));

    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedPayments = paymentsWithDetails.slice(start, start + parseInt(limit));

    res.json(successResponse({
      payments: paginatedPayments,
      total: payments.length,
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Payments retrieved successfully'));

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get payments'));
  }
};

// ==========================================
// GET PURCHASED LINKS
// ==========================================

exports.getPurchasedLinks = async (req, res) => {
  try {
    const userId = req.user.uid;

    const orders = await Order.getByUserId(userId);
    const completedOrders = orders.filter(o => o.paymentStatus === 'completed');

    const purchasedLinks = completedOrders.map(order => ({
      orderId: order.orderId,
      productTitle: order.productTitle,
      whatsappLink: order.whatsappLink,
      purchasedAt: order.completedAt || order.createdAt,
      amount: order.amount,
      isFree: order.isFree,
      isPremium: order.isPremium
    }));

    res.json(successResponse({
      links: purchasedLinks,
      total: purchasedLinks.length
    }, 'Purchased links retrieved successfully'));

  } catch (error) {
    console.error('Get purchased links error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get purchased links'));
  }
};

// ==========================================
// GET USER NOTIFICATIONS
// ==========================================

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const result = await NotificationService.getUserNotifications(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      unreadOnly: unreadOnly === 'true'
    });

    res.json(successResponse(result, 'Notifications retrieved successfully'));

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get notifications'));
  }
};

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================

exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.uid;

    await NotificationService.markAsRead(notificationId, userId);

    res.json(successResponse(null, 'Notification marked as read'));

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to mark notification as read'));
  }
};

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.uid;

    await NotificationService.markAllAsRead(userId);

    res.json(successResponse(null, 'All notifications marked as read'));

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to mark notifications as read'));
  }
};

// ==========================================
// CONTACT SUPPORT
// ==========================================

exports.contactSupport = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user.uid;

    if (!subject || !message) {
      return res.status(400).json(errorResponse('Subject and message are required'));
    }

    const user = await User.getById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    await EmailService.sendNotificationEmail(
      'dullamanyama0@gmail.com',
      `Support Request: ${subject}`,
      `From: ${user.email}\nName: ${user.fullName}\n\n${message}`
    );

    res.json(successResponse(null, 'Support request sent successfully'));

  } catch (error) {
    console.error('Contact support error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to send support request'));
  }
};

// ==========================================
// DELETE USER ACCOUNT (Self)
// ==========================================

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.getById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const orders = await Order.getByUserId(userId);
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
    
    if (pendingOrders.length > 0) {
      return res.status(400).json(errorResponse('Cannot delete account with pending orders.'));
    }

    await User.delete(userId);

    try {
      await admin.auth().deleteUser(userId);
    } catch (authError) {
      console.error('Firebase auth delete error:', authError);
    }

    res.json(successResponse({ userId }, 'Account deleted successfully'));

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to delete account'));
  }
};
