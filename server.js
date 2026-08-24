// ============================================================
// HARAKAPAY PRODUCTION SERVER - server.js
// ============================================================
// Tanzania Digital Links Platform
// Backend with Firebase Admin SDK & HarakaPay Integration
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================
app.use(cors({
  origin: process.env.APP_BASE_URL || '*',
  credentials: true,
}));

// Parse JSON but with raw body for webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ============================================================
// ENVIRONMENT VARIABLES VALIDATION
// ============================================================
const requiredEnv = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'HARAKAPAY_API_KEY',
];

const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length) {
  console.error('❌ Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HP${timestamp}${random}`;
}

// Validate Tanzania phone number
function validateTanzaniaPhone(phone) {
  // Format: 0712345678 or 0712-345678 or 0712 345678
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^0[67][0-9]{8}$/.test(cleaned) || /^255[67][0-9]{8}$/.test(cleaned);
}

// Format phone to international format if needed
function formatPhoneForHarakaPay(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    return cleaned.substring(1);
  }
  return cleaned;
}

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

async function verifyAuthToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
}

// ============================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ============================================================

async function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(403).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    
    if (userData.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    req.userData = userData;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

// ============================================================
// HARAKAPAY API FUNCTIONS
// ============================================================

/**
 * Collect payment via HarakaPay USSD push
 * Based on official documentation: POST /api/v1/collect
 */
async function harakaPayCollect(phone, amount, description, webhookUrl) {
  try {
    const response = await axios.post(
      `${HARAKAPAY_BASE_URL}/api/v1/collect`,
      {
        phone: phone,
        amount: amount,
        description: description || 'Digital product purchase',
        webhook_url: webhookUrl || `${process.env.APP_BASE_URL}/api/webhook/harakapay`,
      },
      {
        headers: {
          'X-API-Key': HARAKAPAY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('HarakaPay collect error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Payment initiation failed');
  }
}

/**
 * Check payment status via HarakaPay
 * Based on official documentation: GET /api/v1/status/{order_id}
 */
async function harakaPayCheckStatus(orderId) {
  try {
    const response = await axios.get(
      `${HARAKAPAY_BASE_URL}/api/v1/status/${orderId}`,
      {
        headers: {
          'X-API-Key': HARAKAPAY_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('HarakaPay status check error:', error.response?.data || error.message);
    throw new Error('Failed to check payment status');
  }
}

/**
 * Get wallet balance from HarakaPay
 * Based on official documentation: GET /api/v1/balance
 */
async function harakaPayGetBalance() {
  try {
    const response = await axios.get(
      `${HARAKAPAY_BASE_URL}/api/v1/balance`,
      {
        headers: {
          'X-API-Key': HARAKAPAY_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('HarakaPay balance error:', error.response?.data || error.message);
    throw new Error('Failed to fetch balance');
  }
}

// ============================================================
// API ROUTES
// ============================================================

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// PRODUCTS - Public
// ============================================================
app.get('/api/products', async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    
    let query = db.collection('products')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    
    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

app.get('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const doc = await db.collection('products').doc(productId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = {
      id: doc.id,
      ...doc.data()
    };

    // Only return active products to public
    if (!product.active) {
      return res.status(404).json({
        success: false,
        error: 'Product not available'
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// ============================================================
// ORDERS - Authenticated Users
// ============================================================
app.post('/api/orders', verifyAuthToken, async (req, res) => {
  try {
    const { productId, phone } = req.body;
    const userId = req.user.uid;

    // Validate phone
    if (!phone || !validateTanzaniaPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Tanzania phone number. Format: 0712345678'
      });
    }

    // Get product
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productDoc.data();

    if (!product.active) {
      return res.status(400).json({
        success: false,
        error: 'Product is not available'
      });
    }

    // Check if product is free
    const isFree = product.price === 0 || product.price === '0';

    // Generate order ID
    const orderId = generateOrderId();

    // Create order document
    const orderData = {
      userId,
      productId,
      productName: product.title,
      amount: product.price,
      currency: 'TZS',
      status: isFree ? 'completed' : 'pending', // Free orders are completed immediately
      type: isFree ? 'free' : 'paid',
      phone: phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store HarakaPay order ID if not free
    let harakaPayOrderId = null;

    if (!isFree) {
      // Initiate payment with HarakaPay
      try {
        const paymentResponse = await harakaPayCollect(
          formatPhoneForHarakaPay(phone),
          product.price,
          product.title,
          `${process.env.APP_BASE_URL}/api/webhook/harakapay`
        );

        if (paymentResponse.success && paymentResponse.order_id) {
          harakaPayOrderId = paymentResponse.order_id;
          orderData.harakaPayOrderId = harakaPayOrderId;
          orderData.orderId = paymentResponse.order_id;
          orderData.paymentInitiatedAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
          throw new Error('Payment initiation failed');
        }
      } catch (error) {
        console.error('Payment initiation error:', error);
        return res.status(400).json({
          success: false,
          error: error.message || 'Failed to initiate payment'
        });
      }
    }

    // Save order to Firestore
    const docRef = await db.collection('orders').add(orderData);

    // If free, fulfill immediately
    if (isFree) {
      await fulfillOrder(docRef.id, userId, productId, product);
    }

    res.json({
      success: true,
      orderId: docRef.id,
      harakaPayOrderId: harakaPayOrderId,
      status: orderData.status,
      isFree: isFree,
      message: isFree ? 'Order created successfully!' : 'Payment initiated. Check your phone to confirm.',
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

// Get user orders
app.get('/api/orders', verifyAuthToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
        completedAt: data.completedAt?.toDate?.() || null,
      });
    });

    res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get single order with link if completed
app.get('/api/orders/:orderId', verifyAuthToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.uid;

    const doc = await db.collection('orders').doc(orderId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const orderData = doc.data();

    // Check if order belongs to user
    if (orderData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const order = {
      id: doc.id,
      ...orderData,
      createdAt: orderData.createdAt?.toDate?.() || null,
      completedAt: orderData.completedAt?.toDate?.() || null,
    };

    // Get product for link
    const productDoc = await db.collection('products').doc(orderData.productId).get();
    const product = productDoc.exists ? productDoc.data() : null;

    // Only include link if order is completed
    let link = null;
    if (orderData.status === 'completed' && product) {
      link = product.downloadUrl || product.link || null;
    }

    res.json({
      success: true,
      order: {
        ...order,
        link: link,
      },
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// ============================================================
// NOTIFICATIONS - Authenticated Users
// ============================================================
app.get('/api/notifications', verifyAuthToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 50 } = req.query;

    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const notifications = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
      });
    });

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

app.put('/api/notifications/:notificationId/read', verifyAuthToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.uid;

    const doc = await db.collection('notifications').doc(notificationId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const data = doc.data();
    
    if (data.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await doc.ref.update({
      read: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification'
    });
  }
});

// ============================================================
// USER - Authenticated
// ============================================================
app.get('/api/user/profile', verifyAuthToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const doc = await db.collection('users').doc(userId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = doc.data();
    
    // Don't expose sensitive data
    delete userData.password;
    delete userData._password;

    res.json({
      success: true,
      user: {
        uid: userId,
        ...userData,
        createdAt: userData.createdAt?.toDate?.() || null,
      },
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// ============================================================
// PAYMENT STATUS CHECK - Authenticated
// ============================================================
app.post('/api/payment/check', verifyAuthToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.uid;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Get order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    // Check if order belongs to user
    if (orderData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // If already completed
    if (orderData.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        orderId: orderId,
        message: 'Payment already completed',
      });
    }

    // Check with HarakaPay
    if (orderData.harakaPayOrderId) {
      try {
        const statusResponse = await harakaPayCheckStatus(orderData.harakaPayOrderId);
        
        if (statusResponse.success && statusResponse.payment) {
          const paymentStatus = statusResponse.payment.status;
          
          if (paymentStatus === 'completed') {
            // Fulfill order
            await fulfillOrder(orderId, userId, orderData.productId);
            
            return res.json({
              success: true,
              status: 'completed',
              orderId: orderId,
              message: 'Payment confirmed!',
            });
          } else if (paymentStatus === 'failed') {
            await db.collection('orders').doc(orderId).update({
              status: 'failed',
              paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return res.json({
              success: true,
              status: 'failed',
              orderId: orderId,
              message: 'Payment failed. Please try again.',
            });
          } else {
            // Still pending
            return res.json({
              success: true,
              status: 'pending',
              orderId: orderId,
              message: 'Payment is still pending. Check your phone.',
            });
          }
        }
      } catch (error) {
        console.error('Payment check error:', error);
        // Don't fail, just return pending if we can't reach HarakaPay
        return res.json({
          success: true,
          status: 'pending',
          orderId: orderId,
          message: 'Unable to verify payment status. Please check your phone or try again later.',
        });
      }
    }

    res.json({
      success: true,
      status: orderData.status || 'pending',
      orderId: orderId,
    });

  } catch (error) {
    console.error('Payment check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment'
    });
  }
});

// ============================================================
// HARAKAPAY WEBHOOK
// Based on official documentation: Webhook Notifications
// ============================================================
app.post('/api/webhook/harakapay', async (req, res) => {
  try {
    const webhookData = req.body;

    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    // Validate webhook data structure based on documentation
    // Expected: { order_id, status, amount, net_amount, fee_amount, created_at, completed_at }
    const { order_id, status, amount, net_amount, fee_amount } = webhookData;

    if (!order_id || !status) {
      console.error('Invalid webhook data:', webhookData);
      return res.status(400).json({ success: false, error: 'Invalid webhook data' });
    }

    // Find order in database
    const ordersSnapshot = await db.collection('orders')
      .where('harakaPayOrderId', '==', order_id)
      .limit(1)
      .get();

    if (ordersSnapshot.empty) {
      console.error('Order not found for webhook:', order_id);
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const orderDoc = ordersSnapshot.docs[0];
    const orderId = orderDoc.id;
    const orderData = orderDoc.data();

    // Prevent duplicate processing (idempotency)
    if (orderData.status === 'completed' || orderData.status === 'failed') {
      console.log(`Order ${orderId} already processed with status: ${orderData.status}`);
      return res.json({ success: true, message: 'Already processed' });
    }

    // Process based on status
    if (status === 'completed') {
      // Verify amount matches
      const expectedAmount = parseInt(orderData.amount);
      const receivedAmount = parseInt(amount);

      if (receivedAmount !== expectedAmount) {
        console.error(`Amount mismatch for order ${orderId}: Expected ${expectedAmount}, Received ${receivedAmount}`);
        
        // Mark as failed due to amount mismatch
        await db.collection('orders').doc(orderId).update({
          status: 'failed',
          paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: 'Amount mismatch',
        });

        // Create notification for user
        await createNotification(
          orderData.userId,
          'Payment Verification Failed',
          `Payment amount (TZS ${receivedAmount}) does not match expected amount (TZS ${expectedAmount}). Please contact support.`,
          'error'
        );

        return res.json({ success: true, message: 'Amount mismatch' });
      }

      // Fulfill order
      await fulfillOrder(orderId, orderData.userId, orderData.productId);

      res.json({ success: true, message: 'Order completed' });

    } else if (status === 'failed') {
      // Mark order as failed
      await db.collection('orders').doc(orderId).update({
        status: 'failed',
        paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create notification for user
      await createNotification(
        orderData.userId,
        'Payment Failed',
        `Your payment of TZS ${amount} has failed. Please try again or contact support.`,
        'error'
      );

      res.json({ success: true, message: 'Order failed' });

    } else {
      console.log(`Unhandled webhook status: ${status}`);
      res.json({ success: true, message: 'Webhook received but status not processed' });
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Always return 200 to acknowledge receipt (per HarakaPay documentation)
    res.json({ 
      success: false, 
      error: 'Webhook processing failed',
      message: 'Webhook received but processing failed. Check logs.'
    });
  }
});

// ============================================================
// HELPER: Fulfill Order
// ============================================================
async function fulfillOrder(orderId, userId, productId) {
  try {
    // Get product
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      throw new Error('Product not found');
    }

    const product = productDoc.data();

    // Update order to completed
    await db.collection('orders').doc(orderId).update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification for user
    await createNotification(
      userId,
      'Order Completed! 🎉',
      `Your product "${product.title}" is now available. View it in My Orders.`,
      'success'
    );

    console.log(`Order ${orderId} fulfilled for user ${userId}`);
  } catch (error) {
    console.error('Fulfill order error:', error);
    throw error;
  }
}

// ============================================================
// HELPER: Create Notification
// ============================================================
async function createNotification(userId, title, message, type = 'info') {
  try {
    await db.collection('notifications').add({
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

// ============================================================
// ADMIN ROUTES
// ============================================================

// ============================================================
// ADMIN: Dashboard Stats
// ============================================================
app.get('/api/admin/stats', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    // Get total users
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // Get orders stats
    const ordersSnapshot = await db.collection('orders').get();
    
    let totalOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let failedOrders = 0;
    let totalSales = 0;

    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      totalOrders++;
      
      if (data.status === 'pending') pendingOrders++;
      else if (data.status === 'completed') {
        completedOrders++;
        totalSales += parseInt(data.amount) || 0;
      }
      else if (data.status === 'failed') failedOrders++;
    });

    // Get products
    const productsSnapshot = await db.collection('products').where('active', '==', true).get();
    const activeProducts = productsSnapshot.size;

    // Get free offers
    const offersSnapshot = await db.collection('offers').where('active', '==', true).get();
    const activeOffers = offersSnapshot.size;

    // Get HarakaPay balance
    let balance = null;
    try {
      const balanceData = await harakaPayGetBalance();
      if (balanceData.success) {
        balance = {
          wallet_balance: balanceData.wallet_balance,
          float_balance: balanceData.float_balance,
        };
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error.message);
    }

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        pendingOrders,
        completedOrders,
        failedOrders,
        totalSales,
        activeProducts,
        activeOffers,
        balance,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

// ============================================================
// ADMIN: Products Management
// ============================================================
app.get('/api/admin/products', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('products')
      .orderBy('createdAt', 'desc')
      .get();

    const products = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
      });
    });

    res.json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

app.post('/api/admin/products', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      imageUrl,
      link,
      active = true,
    } = req.body;

    // Validate
    if (!title || !price || !link) {
      return res.status(400).json({
        success: false,
        error: 'Title, price, and link are required'
      });
    }

    if (isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price must be a valid number'
      });
    }

    const productData = {
      title,
      description: description || '',
      price: parseFloat(price),
      currency: 'TZS',
      category: category || 'General',
      imageUrl: imageUrl || '',
      downloadUrl: link,
      link: link,
      active: active === true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('products').add(productData);

    res.json({
      success: true,
      message: 'Product created successfully',
      productId: docRef.id,
    });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
});

app.put('/api/admin/products/:productId', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.createdAt;

    const docRef = db.collection('products').doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update product
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    if (updates.price !== undefined) {
      updates.price = parseFloat(updates.price);
    }

    await docRef.update(updates);

    res.json({
      success: true,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

app.delete('/api/admin/products/:productId', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;

    const docRef = db.collection('products').doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Soft delete - deactivate instead of hard delete
    await docRef.update({
      active: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Product deactivated successfully',
    });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

// ============================================================
// ADMIN: Orders Management
// ============================================================
app.get('/api/admin/orders', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    let query = db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();

    const orders = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Get user info
      let user = null;
      try {
        const userDoc = await db.collection('users').doc(data.userId).get();
        if (userDoc.exists) {
          user = userDoc.data();
        }
      } catch (e) {
        console.error('Error fetching user:', e);
      }

      orders.push({
        id: doc.id,
        ...data,
        user: user ? { name: user.name, email: user.email, phone: user.phone } : null,
        createdAt: data.createdAt?.toDate?.() || null,
        completedAt: data.completedAt?.toDate?.() || null,
      });
    }

    res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// ============================================================
// ADMIN: Users Management
// ============================================================
app.get('/api/admin/users', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const snapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const users = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Get order count and total spent
      let orderCount = 0;
      let totalSpent = 0;
      
      try {
        const ordersSnapshot = await db.collection('orders')
          .where('userId', '==', doc.id)
          .where('status', '==', 'completed')
          .get();
        
        orderCount = ordersSnapshot.size;
        ordersSnapshot.forEach(orderDoc => {
          totalSpent += parseInt(orderDoc.data().amount) || 0;
        });
      } catch (e) {
        console.error('Error fetching orders for user:', e);
      }

      users.push({
        uid: doc.id,
        ...data,
        orderCount,
        totalSpent,
        createdAt: data.createdAt?.toDate?.() || null,
      });
    }

    res.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// ============================================================
// ADMIN: Notifications
// ============================================================
app.post('/api/admin/notifications', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { userIds, title, message, type = 'info' } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User IDs required'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required'
      });
    }

    // Create notification for each user
    const promises = userIds.map(userId => 
      createNotification(userId, title, message, type)
    );

    await Promise.all(promises);

    res.json({
      success: true,
      message: `Notifications sent to ${userIds.length} users`,
    });
  } catch (error) {
    console.error('Admin send notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

// ============================================================
// ADMIN: Free Offers
// ============================================================
app.post('/api/admin/offers', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const { userId, productId, message, expiresAt } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Product ID are required'
      });
    }

    // Verify user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product exists
    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const offerData = {
      userId,
      productId,
      message: message || 'You have received a free offer!',
      active: true,
      claimed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt)) : null,
    };

    const docRef = await db.collection('offers').add(offerData);

    // Create notification for user
    await createNotification(
      userId,
      '🎁 Free Offer Available!',
      message || 'You have received a free product offer. Claim it now in your dashboard!',
      'success'
    );

    res.json({
      success: true,
      message: 'Offer created successfully',
      offerId: docRef.id,
    });
  } catch (error) {
    console.error('Admin create offer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create offer'
    });
  }
});

// ============================================================
// USER: Claim Free Offer
// ============================================================
app.post('/api/offers/claim', verifyAuthToken, async (req, res) => {
  try {
    const { offerId } = req.body;
    const userId = req.user.uid;

    if (!offerId) {
      return res.status(400).json({
        success: false,
        error: 'Offer ID is required'
      });
    }

    const offerDoc = await db.collection('offers').doc(offerId).get();
    
    if (!offerDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    const offerData = offerDoc.data();

    // Validate offer belongs to user
    if (offerData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'This offer is not for you'
      });
    }

    // Validate offer is active and not claimed
    if (!offerData.active || offerData.claimed) {
      return res.status(400).json({
        success: false,
        error: 'Offer is no longer available'
      });
    }

    // Validate expiration
    if (offerData.expiresAt && offerData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Offer has expired'
      });
    }

    // Get product
    const productDoc = await db.collection('products').doc(offerData.productId).get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productDoc.data();

    // Create free order
    const orderId = generateOrderId();

    const orderData = {
      userId: userId,
      productId: offerData.productId,
      productName: product.title,
      amount: 0,
      currency: 'TZS',
      status: 'completed',
      type: 'free',
      orderId: orderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      offerId: offerId,
    };

    await db.collection('orders').add(orderData);

    // Mark offer as claimed
    await offerDoc.ref.update({
      claimed: true,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification
    await createNotification(
      userId,
      '✅ Offer Claimed!',
      `You have successfully claimed "${product.title}". View it in My Orders.`,
      'success'
    );

    res.json({
      success: true,
      message: 'Offer claimed successfully!',
      product: {
        title: product.title,
        link: product.downloadUrl || product.link || null,
      },
    });
  } catch (error) {
    console.error('Claim offer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim offer'
    });
  }
});

// ============================================================
// GET USER OFFERS
// ============================================================
app.get('/api/offers', verifyAuthToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    const snapshot = await db.collection('offers')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const offers = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      offers.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
        expiresAt: data.expiresAt?.toDate?.() || null,
        claimedAt: data.claimedAt?.toDate?.() || null,
      });
    });

    res.json({
      success: true,
      offers,
      count: offers.length,
    });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offers'
    });
  }
});

// ============================================================
// ADMIN: HarakaPay Balance
// ============================================================
app.get('/api/admin/balance', verifyAuthToken, verifyAdmin, async (req, res) => {
  try {
    const balance = await harakaPayGetBalance();
    
    res.json({
      success: true,
      ...balance,
    });
  } catch (error) {
    console.error('Admin balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance'
    });
  }
});

// ============================================================
// AUTHENTICATION ENDPOINTS (Firebase Auth)
// ============================================================

// User signup endpoint - creates user in Firestore
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    if (phone && !validateTanzaniaPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Tanzania phone number'
      });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone ? `+${formatPhoneForHarakaPay(phone)}` : undefined,
    });

    // Save user to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name,
      email,
      phone: phone || '',
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'User created successfully',
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create user'
    });
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 HarakaPay Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 HarakaPay API: ${HARAKAPAY_BASE_URL}`);
  console.log(`✅ Server ready`);
});

module.exports = app;
