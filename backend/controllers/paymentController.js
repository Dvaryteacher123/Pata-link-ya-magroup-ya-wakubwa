// ==========================================
// PAYMENT CONTROLLER
// ==========================================

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const HarakaPayService = require('../services/harakapayService');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const { 
  successResponse, 
  errorResponse, 
  generateOrderId,
  generatePaymentId,
  formatCurrency
} = require('../utils/helpers');

// ==========================================
// INITIATE PAYMENT
// ==========================================

exports.initiatePayment = async (req, res) => {
  try {
    const { productId, phone } = req.body;
    const userId = req.user.uid;

    const product = await Product.getById(productId);
    if (!product) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    if (product.isFree) {
      return res.status(400).json(errorResponse('This product is free. No payment required.'));
    }

    if (!product.isVisible) {
      return res.status(400).json(errorResponse('This product is currently not available'));
    }

    const existingOrders = await Order.getByUserId(userId);
    const alreadyPurchased = existingOrders.some(order => 
      order.productId === productId && 
      order.paymentStatus === 'completed'
    );
    
    if (alreadyPurchased) {
      return res.status(400).json(errorResponse('You have already purchased this product'));
    }

    const formattedPhone = HarakaPayService.formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json(errorResponse('Invalid phone number format'));
    }

    const orderId = generateOrderId();
    const paymentId = generatePaymentId();

    const user = await User.getById(userId);

    const orderData = {
      orderId: orderId,
      userId: userId,
      productId: productId,
      productTitle: product.title,
      amount: product.price,
      phone: formattedPhone,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'harakapay',
      whatsappLink: product.whatsappLink,
      isFree: product.isFree,
      isPremium: product.isPremium
    };

    const order = await Order.create(orderData);

    const paymentData = {
      paymentId: paymentId,
      orderId: order.id,
      userId: userId,
      productId: productId,
      amount: product.price,
      phone: formattedPhone,
      status: 'pending'
    };

    const payment = await Payment.create(paymentData);

    const harakaPayResult = await HarakaPayService.initiatePayment({
      orderId: orderId,
      amount: product.price,
      phone: formattedPhone,
      userId: userId,
      productId: productId,
      productTitle: product.title
    });

    if (!harakaPayResult.success) {
      await Order.updatePaymentStatus(order.id, 'failed');
      await Payment.updateStatus(payment.id, 'failed');
      return res.status(400).json(errorResponse(harakaPayResult.error || 'Payment initiation failed'));
    }

    await Payment.updateStatus(payment.id, 'pending', {
      transactionId: harakaPayResult.transactionId
    });

    await NotificationService.sendPaymentNotification(
      userId,
      order.id,
      product.title,
      product.price,
      'pending'
    );

    res.json(successResponse({
      orderId: orderId,
      paymentId: paymentId,
      transactionId: harakaPayResult.transactionId,
      amount: product.price,
      phone: formattedPhone,
      status: 'pending'
    }, 'Payment initiated successfully'));

  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to initiate payment'));
  }
};

// ==========================================
// CHECK PAYMENT STATUS
// ==========================================

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.getByOrderId(orderId);
    if (!order) {
      return res.status(404).json(errorResponse('Order not found'));
    }

    if (order.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json(errorResponse('You do not have permission to view this order'));
    }

    const payment = await Payment.getByOrderId(order.id);
    if (!payment) {
      return res.status(404).json(errorResponse('Payment not found'));
    }

    if (payment.status !== 'pending') {
      return res.json(successResponse({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        status: payment.status,
        completedAt: payment.completedAt || null,
        amount: payment.amount,
        productTitle: order.productTitle
      }, 'Payment status retrieved successfully'));
    }

    const harakaPayResult = await HarakaPayService.checkPaymentStatus(payment.paymentId);

    if (harakaPayResult.success) {
      const newStatus = harakaPayResult.status === 'completed' ? 'completed' : 
                        harakaPayResult.status === 'failed' ? 'failed' : 'pending';
      
      if (newStatus !== 'pending') {
        await Payment.updateStatus(payment.id, newStatus, {
          transactionId: harakaPayResult.data?.transactionId || payment.transactionId
        });

        await Order.updatePaymentStatus(order.id, newStatus, {
          paymentId: payment.paymentId,
          transactionId: harakaPayResult.data?.transactionId || payment.transactionId
        });

        if (newStatus === 'completed') {
          const product = await Product.getById(order.productId);
          if (product) {
            await Product.update(product.id, { 
              stats: { purchases: (product.stats?.purchases || 0) + 1 }
            });
          }

          const user = await User.getById(order.userId);
          if (user) {
            await User.update(user.uid, {
              stats: {
                totalPurchases: (user.stats?.totalPurchases || 0) + 1,
                totalSpent: (user.stats?.totalSpent || 0) + order.amount
              }
            });
          }

          await EmailService.sendPaymentConfirmationEmail({
            email: user?.email,
            userName: user?.fullName,
            orderId: order.orderId,
            productTitle: order.productTitle,
            amount: order.amount,
            whatsappLink: order.whatsappLink
          });

          await NotificationService.sendPaymentNotification(
            order.userId,
            order.id,
            order.productTitle,
            order.amount,
            'completed'
          );
        }
      }

      return res.json(successResponse({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        status: newStatus,
        amount: payment.amount,
        productTitle: order.productTitle
      }, 'Payment status retrieved successfully'));
    }

    res.json(successResponse({
      orderId: order.orderId,
      paymentId: payment.paymentId,
      status: 'pending'
    }, 'Payment is still being processed'));

  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to check payment status'));
  }
};

// ==========================================
// PAYMENT WEBHOOK
// ==========================================

exports.paymentWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-webhook-signature'] || req.headers['signature'];

    const verification = HarakaPayService.verifyWebhookSignature(payload, signature);
    
    if (!verification.isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const result = await HarakaPayService.processWebhook(payload);

    const payment = await Payment.getByPaymentId(result.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const order = await Order.getById(payment.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updatedPayment = await Payment.handleWebhook(result.paymentId, result.data);

    const newStatus = result.completed ? 'completed' : 
                      result.failed ? 'failed' : 'pending';
    
    await Order.updatePaymentStatus(order.id, newStatus, {
      paymentId: payment.paymentId,
      transactionId: result.transactionId || payment.transactionId
    });

    if (result.completed) {
      const product = await Product.getById(order.productId);
      if (product) {
        await Product.update(product.id, { 
          stats: { purchases: (product.stats?.purchases || 0) + 1 }
        });
      }

      const user = await User.getById(order.userId);
      if (user) {
        await User.update(user.uid, {
          stats: {
            totalPurchases: (user.stats?.totalPurchases || 0) + 1,
            totalSpent: (user.stats?.totalSpent || 0) + order.amount
          }
        });
      }

      await EmailService.sendPaymentConfirmationEmail({
        email: user?.email,
        userName: user?.fullName,
        orderId: order.orderId,
        productTitle: order.productTitle,
        amount: order.amount,
        whatsappLink: order.whatsappLink
      });

      await NotificationService.sendPaymentNotification(
        order.userId,
        order.id,
        order.productTitle,
        order.amount,
        'completed'
      );
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      data: { paymentId: result.paymentId, status: newStatus }
    });

  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ==========================================
// GET PAYMENT HISTORY (User)
// ==========================================

exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 20, status } = req.query;

    const filters = { userId };
    if (status) filters.status = status;

    const payments = await Payment.getAll(filters, parseInt(limit) * parseInt(page));

    const paymentHistory = await Promise.all(payments.map(async (payment) => {
      const order = await Order.getById(payment.orderId);
      return {
        paymentId: payment.paymentId,
        orderId: order?.orderId || null,
        productTitle: order?.productTitle || 'Unknown Product',
        amount: payment.amount,
        status: payment.status,
        phone: payment.phone,
        completedAt: payment.completedAt,
        createdAt: payment.createdAt
      };
    }));

    res.json(successResponse({
      history: paymentHistory,
      total: payments.length,
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Payment history retrieved successfully'));

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get payment history'));
  }
};

// ==========================================
// GET PAYMENT STATS (Admin)
// ==========================================

exports.getPaymentStats = async (req, res) => {
  try {
    const payments = await Payment.getAll({}, 1000);

    const stats = {
      total: payments.length,
      pending: 0,
      completed: 0,
      failed: 0,
      totalAmount: 0,
      pendingAmount: 0,
      completedAmount: 0,
      failedAmount: 0
    };

    payments.forEach(payment => {
      const amount = payment.amount || 0;
      
      if (payment.status === 'pending') {
        stats.pending++;
        stats.pendingAmount += amount;
      } else if (payment.status === 'completed') {
        stats.completed++;
        stats.completedAmount += amount;
        stats.totalAmount += amount;
      } else if (payment.status === 'failed') {
        stats.failed++;
        stats.failedAmount += amount;
      }
    });

    res.json(successResponse(stats, 'Payment stats retrieved successfully'));

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get payment stats'));
  }
};
