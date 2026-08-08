// ==========================================
// ADMIN CONTROLLER
// ==========================================

const { db, collections } = require('../config/firebase');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/helpers');

// ==========================================
// GET DASHBOARD STATS
// ==========================================

exports.getDashboardStats = async (req, res) => {
  try {
    const users = await User.getAll({}, 1000);
    const activeUsers = users.filter(u => u.status === 'active');
    
    const products = await Product.getAll({}, 1000);
    const visibleProducts = products.filter(p => p.isVisible);
    
    const orders = await Order.getAll({}, 1000);
    const completedOrders = orders.filter(o => o.paymentStatus === 'completed');
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
    
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    const payments = await Payment.getAll({}, 1000);
    const pendingPayments = payments.filter(p => p.status === 'pending');
    const completedPayments = payments.filter(p => p.status === 'completed');
    const failedPayments = payments.filter(p => p.status === 'failed');

    const stats = {
      users: { total: users.length, active: activeUsers.length },
      products: { total: products.length, visible: visibleProducts.length },
      orders: { total: orders.length, completed: completedOrders.length, pending: pendingOrders.length },
      payments: { total: payments.length, pending: pendingPayments.length, completed: completedPayments.length, failed: failedPayments.length },
      revenue: { total: totalRevenue }
    };

    res.json(successResponse(stats, 'Dashboard stats retrieved successfully'));

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get dashboard stats'));
  }
};

// ==========================================
// GET ALL USERS (Admin)
// ==========================================

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAll({}, 1000);

    res.json(successResponse({ users }, 'Users retrieved successfully'));

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get users'));
  }
};

// ==========================================
= SUSPEND USER (Admin)
// ==========================================

exports.suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.getById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await User.update(userId, { status: newStatus });

    await NotificationService.createNotification({
      userId: userId,
      title: newStatus === 'suspended' ? 'Account Suspended' : 'Account Activated',
      message: newStatus === 'suspended' ? 'Your account has been suspended' : 'Your account has been activated',
      type: newStatus === 'suspended' ? 'error' : 'success',
      target: 'specific'
    });

    res.json(successResponse({ userId, status: newStatus }, `User ${newStatus} successfully`));

  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to suspend user'));
  }
};

// ==========================================
// GET ALL PRODUCTS (Admin)
// ==========================================

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.getAll({}, 1000);

    res.json(successResponse({ products }, 'Products retrieved successfully'));

  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get products'));
  }
};

// ==========================================
// CREATE PRODUCT (Admin)
// ==========================================

exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const newProduct = await Product.create(productData);

    await NotificationService.createNotification({
      userId: null,
      title: 'New Product Added',
      message: `Product "${newProduct.title}" has been added`,
      type: 'info',
      target: 'all'
    });

    res.status(201).json(successResponse(newProduct, 'Product created successfully'));

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to create product'));
  }
};

// ==========================================
// UPDATE PRODUCT (Admin)
// ==========================================

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    const updatedProduct = await Product.update(id, updateData);

    res.json(successResponse(updatedProduct, 'Product updated successfully'));

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update product'));
  }
};

// ==========================================
// DELETE PRODUCT (Admin)
// ==========================================

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    await Product.delete(id);

    res.json(successResponse({ id }, 'Product deleted successfully'));

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to delete product'));
  }
};

// ==========================================
// TOGGLE PRODUCT (Admin)
// ==========================================

exports.toggleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Product.toggleVisibility(id);

    res.json(successResponse(result, `Product ${result.isVisible ? 'published' : 'hidden'} successfully`));

  } catch (error) {
    console.error('Toggle product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to toggle product'));
  }
};

// ==========================================
// GET ALL ORDERS (Admin)
// ==========================================

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.getAll({}, 1000);

    res.json(successResponse({ orders }, 'Orders retrieved successfully'));

  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get orders'));
  }
};

// ==========================================
// GET ALL PAYMENTS (Admin)
// ==========================================

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.getAll({}, 1000);

    res.json(successResponse({ payments }, 'Payments retrieved successfully'));

  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get payments'));
  }
};

// ==========================================
// GET CATEGORIES (Admin)
// ==========================================

exports.getCategories = async (req, res) => {
  try {
    const categories = await db.collection(collections.CATEGORIES).get();
    const result = [];
    categories.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    res.json(successResponse(result, 'Categories retrieved successfully'));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get categories'));
  }
};

// ==========================================
// CREATE CATEGORY (Admin)
// ==========================================

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json(errorResponse('Category name is required'));

    const docRef = db.collection(collections.CATEGORIES).doc();
    await docRef.set({ name, createdAt: new Date().toISOString() });

    res.status(201).json(successResponse({ id: docRef.id, name }, 'Category created successfully'));
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to create category'));
  }
};

// ==========================================
// DELETE CATEGORY (Admin)
// ==========================================

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection(collections.CATEGORIES).doc(id).delete();
    res.json(successResponse({ id }, 'Category deleted successfully'));
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to delete category'));
  }
};

// ==========================================
// GET SETTINGS (Admin)
// ==========================================

exports.getSettings = async (req, res) => {
  try {
    const doc = await db.collection(collections.SETTINGS).doc('system').get();
    const settings = doc.exists ? doc.data() : {};
    res.json(successResponse(settings, 'Settings retrieved successfully'));
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get settings'));
  }
};

// ==========================================
// UPDATE SETTINGS (Admin)
// ==========================================

exports.updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    await db.collection(collections.SETTINGS).doc('system').set(settings, { merge: true });
    res.json(successResponse(settings, 'Settings updated successfully'));
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update settings'));
  }
};

// ==========================================
// SEND NOTIFICATION (Admin)
// ==========================================

exports.sendNotification = async (req, res) => {
  try {
    const { title, message, target = 'all' } = req.body;

    if (!title || !message) {
      return res.status(400).json(errorResponse('Title and message are required'));
    }

    const users = await User.getAll({}, 1000);
    const userIds = users.map(u => u.uid);

    const result = await NotificationService.sendToManyUsers(userIds, { title, message, target });

    res.json(successResponse(result, `Notification sent to ${result.totalSent} users`));

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to send notification'));
  }
};
