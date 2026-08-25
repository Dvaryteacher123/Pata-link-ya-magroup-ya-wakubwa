// ============================================================
// HARAKAPAY DIGITAL LINKS - FULL PRODUCTION SERVER
// ============================================================
// Tanzania Digital Links Platform
// All data from Firestore | HarakaPay Integration
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================
let db = null;
let auth = null;
let firebaseInitialized = false;

try {
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
        console.error('❌ Missing Firebase credentials in .env');
    } else {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin initialized successfully');
            firebaseInitialized = true;
        }

        db = admin.firestore();
        auth = admin.auth();
        console.log('✅ Firestore connected');
        console.log('📁 Project ID:', process.env.FIREBASE_PROJECT_ID);
    }
} catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
}

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================
app.use(cors({
    origin: '*',
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// HARAKAPAY CONFIGURATION
// ============================================================
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HP${timestamp}${random}`;
}

function validateTanzaniaPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^0[67][0-9]{8}$/.test(cleaned) || /^255[67][0-9]{8}$/.test(cleaned);
}

function formatPhoneForHarakaPay(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('0')) {
        return cleaned.substring(1);
    }
    return cleaned;
}

// ============================================================
// HARAKAPAY API FUNCTIONS
// ============================================================

// 1. Collect Payment - POST /api/v1/collect
async function harakaPayCollect(phone, amount, description, webhookUrl) {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

    try {
        const response = await axios.post(
            `${HARAKAPAY_BASE_URL}/api/v1/collect`,
            {
                phone: phone,
                amount: amount,
                description: description || 'Digital product purchase',
                webhook_url: webhookUrl || `${APP_BASE_URL}/api/webhook/harakapay`,
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

// 2. Check Payment Status - GET /api/v1/status/{order_id}
async function harakaPayCheckStatus(orderId) {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

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

// 3. Get Balance - GET /api/v1/balance
async function harakaPayGetBalance() {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

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
// CREATE NOTIFICATION HELPER
// ============================================================
async function createNotification(userId, title, message, type = 'info') {
    try {
        if (!firebaseInitialized || !db) return;
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
// FULFILL ORDER HELPER
// ============================================================
async function fulfillOrder(orderId, userId, productId) {
    try {
        if (!firebaseInitialized || !db) {
            throw new Error('Firebase not initialized');
        }

        const productDoc = await db.collection('products').doc(productId).get();

        if (!productDoc.exists) {
            throw new Error('Product not found');
        }

        const product = productDoc.data();

        await db.collection('orders').doc(orderId).update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await createNotification(
            userId,
            'Order Completed! 🎉',
            `Your product "${product.title}" is now available. View it in My Orders.`,
            'success'
        );

        console.log(`✅ Order ${orderId} fulfilled for user ${userId}`);
    } catch (error) {
        console.error('Fulfill order error:', error);
        throw error;
    }
}

// ============================================================
// SERVE STATIC HTML FILES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.use(express.static(path.join(__dirname)));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        firebase: firebaseInitialized ? 'connected' : 'disconnected',
        harakapay: HARAKAPAY_API_KEY ? 'configured' : 'not configured',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// AUTH ROUTES
// ============================================================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        if (!firebaseInitialized || !auth || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        // Check if user exists
        const existingUserSnapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!existingUserSnapshot.empty) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered. Please login.'
            });
        }

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
        });

        // Save user to Firestore
        await db.collection('users').doc(userRecord.uid).set({
            name: name,
            email: email,
            phone: phone || '',
            role: 'user',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            uid: userRecord.uid,
            user: {
                name: name,
                email: email,
                phone: phone || '',
                role: 'user'
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to create account'
        });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const userSnapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            return res.status(401).json({
                success: false,
                error: 'Email not found. Please sign up first.'
            });
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        // Update last login
        await db.collection('users').doc(userDoc.id).update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                uid: userDoc.id,
                name: userData.name || '',
                email: userData.email || '',
                phone: userData.phone || '',
                role: userData.role || 'user'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again later.'
        });
    }
});

// ============================================================
// PRODUCTS - Read from Firestore (Public)
// ============================================================
app.get('/api/products', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

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
            const data = doc.data();
            products.push({
                id: doc.id,
                title: data.title || 'Untitled',
                description: data.description || '',
                price: data.price || 0,
                currency: data.currency || 'TZS',
                category: data.category || 'General',
                imageUrl: data.imageUrl || '',
                link: data.link || data.downloadUrl || '',
                active: data.active || false,
                createdAt: data.createdAt?.toDate?.() || null,
            });
        });

        res.json({
            success: true,
            products,
            count: products.length,
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products from Firestore'
        });
    }
});

// GET single product
app.get('/api/products/:productId', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { productId } = req.params;
        const doc = await db.collection('products').doc(productId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
            });
        }

        const data = doc.data();

        res.json({
            success: true,
            product: {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || null,
            },
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product from Firestore'
        });
    }
});

// ============================================================
// ADMIN PRODUCTS - Write to Firestore
// ============================================================

// GET all products (Admin)
app.get('/api/admin/products', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products from Firestore'
        });
    }
});

// CREATE product
app.post('/api/admin/products', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const {
            title,
            description,
            price,
            category,
            imageUrl,
            link,
            active = true,
        } = req.body;

        if (!title || price === undefined || !link) {
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
            message: 'Product created successfully in Firestore',
            productId: docRef.id,
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin create product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create product in Firestore'
        });
    }
});

// UPDATE product
app.put('/api/admin/products/:productId', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { productId } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.createdAt;

        const docRef = db.collection('products').doc(productId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
            });
        }

        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        if (updates.price !== undefined) {
            updates.price = parseFloat(updates.price);
        }

        await docRef.update(updates);

        res.json({
            success: true,
            message: 'Product updated successfully in Firestore',
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin update product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update product in Firestore'
        });
    }
});

// DELETE product (soft delete)
app.delete('/api/admin/products/:productId', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { productId } = req.params;

        const docRef = db.collection('products').doc(productId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
            });
        }

        await docRef.update({
            active: false,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'Product deactivated successfully in Firestore',
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin delete product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete product from Firestore'
        });
    }
});

// ============================================================
// ORDERS
// ============================================================

// CREATE order
app.post('/api/orders', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { productId, phone, userId } = req.body;
        const uid = userId || 'anonymous';

        const cleanedPhone = phone ? phone.replace(/[\s\-\(\)]/g, '') : '';
        if (!cleanedPhone || !validateTanzaniaPhone(cleanedPhone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Tanzania phone number. Format: 0712345678'
            });
        }

        const productDoc = await db.collection('products').doc(productId).get();

        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
            });
        }

        const product = productDoc.data();

        if (!product.active) {
            return res.status(400).json({
                success: false,
                error: 'Product is not available'
            });
        }

        const isFree = product.price === 0 || product.price === '0';

        const orderData = {
            userId: uid,
            productId,
            productName: product.title,
            amount: product.price,
            currency: 'TZS',
            status: isFree ? 'completed' : 'pending',
            type: isFree ? 'free' : 'paid',
            phone: cleanedPhone,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        let harakaPayOrderId = null;

        if (!isFree && HARAKAPAY_API_KEY) {
            try {
                const paymentResponse = await harakaPayCollect(
                    formatPhoneForHarakaPay(cleanedPhone),
                    product.price,
                    product.title,
                    `${APP_BASE_URL}/api/webhook/harakapay`
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

        const docRef = await db.collection('orders').add(orderData);

        if (isFree) {
            await fulfillOrder(docRef.id, uid, productId);
        }

        res.json({
            success: true,
            orderId: docRef.id,
            harakaPayOrderId: harakaPayOrderId,
            status: orderData.status,
            isFree: isFree,
            message: isFree ? 'Order created successfully!' : 'Payment initiated. Check your phone to confirm.',
            source: 'firestore'
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order'
        });
    }
});

// GET user orders
app.get('/api/orders', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const userId = req.query.userId || 'anonymous';

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders from Firestore'
        });
    }
});

// GET single order
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { orderId } = req.params;
        const doc = await db.collection('orders').doc(orderId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Order not found in Firestore'
            });
        }

        const orderData = doc.data();

        const order = {
            id: doc.id,
            ...orderData,
            createdAt: orderData.createdAt?.toDate?.() || null,
            completedAt: orderData.completedAt?.toDate?.() || null,
        };

        const productDoc = await db.collection('products').doc(orderData.productId).get();
        const product = productDoc.exists ? productDoc.data() : null;

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order from Firestore'
        });
    }
});

// ============================================================
// PAYMENT STATUS CHECK
// ============================================================
app.post('/api/payment/check', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'Order ID is required'
            });
        }

        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const orderDoc = await db.collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Order not found in Firestore'
            });
        }

        const orderData = orderDoc.data();

        if (orderData.status === 'completed') {
            return res.json({
                success: true,
                status: 'completed',
                orderId: orderId,
                message: 'Payment already completed',
                source: 'firestore'
            });
        }

        if (orderData.harakaPayOrderId && HARAKAPAY_API_KEY) {
            try {
                const statusResponse = await harakaPayCheckStatus(orderData.harakaPayOrderId);

                if (statusResponse.success && statusResponse.payment) {
                    const paymentStatus = statusResponse.payment.status;

                    if (paymentStatus === 'completed') {
                        await fulfillOrder(orderId, orderData.userId, orderData.productId);

                        return res.json({
                            success: true,
                            status: 'completed',
                            orderId: orderId,
                            message: 'Payment confirmed!',
                            source: 'harakapay'
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
                            source: 'harakapay'
                        });
                    } else {
                        return res.json({
                            success: true,
                            status: 'pending',
                            orderId: orderId,
                            message: 'Payment is still pending. Check your phone.',
                            source: 'harakapay'
                        });
                    }
                }
            } catch (error) {
                console.error('Payment check error:', error);
                return res.json({
                    success: true,
                    status: 'pending',
                    orderId: orderId,
                    message: 'Unable to verify payment status. Please check your phone or try again later.',
                    source: 'error'
                });
            }
        }

        res.json({
            success: true,
            status: orderData.status || 'pending',
            orderId: orderId,
            source: 'firestore'
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
// ============================================================
app.post('/api/webhook/harakapay', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('📨 Webhook received:', JSON.stringify(webhookData, null, 2));

        const { order_id, status, amount } = webhookData;

        if (!order_id || !status) {
            console.error('Invalid webhook data:', webhookData);
            return res.status(400).json({ success: false, error: 'Invalid webhook data' });
        }

        if (!firebaseInitialized || !db) {
            return res.status(500).json({ success: false, error: 'Firebase not initialized' });
        }

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

        if (orderData.status === 'completed' || orderData.status === 'failed') {
            console.log(`Order ${orderId} already processed with status: ${orderData.status}`);
            return res.json({ success: true, message: 'Already processed' });
        }

        if (status === 'completed') {
            const expectedAmount = parseInt(orderData.amount);
            const receivedAmount = parseInt(amount);

            if (receivedAmount !== expectedAmount) {
                console.error(`Amount mismatch for order ${orderId}: Expected ${expectedAmount}, Received ${receivedAmount}`);

                await db.collection('orders').doc(orderId).update({
                    status: 'failed',
                    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
                    failureReason: 'Amount mismatch',
                });

                await createNotification(
                    orderData.userId,
                    'Payment Verification Failed',
                    `Payment amount (TZS ${receivedAmount}) does not match expected amount (TZS ${expectedAmount}). Please contact support.`,
                    'error'
                );

                return res.json({ success: true, message: 'Amount mismatch' });
            }

            await fulfillOrder(orderId, orderData.userId, orderData.productId);
            res.json({ success: true, message: 'Order completed' });

        } else if (status === 'failed') {
            await db.collection('orders').doc(orderId).update({
                status: 'failed',
                paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

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
        res.json({
            success: false,
            error: 'Webhook processing failed',
            message: 'Webhook received but processing failed. Check logs.'
        });
    }
});

// ============================================================
// ADMIN STATS
// ============================================================
app.get('/api/admin/stats', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

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
            } else if (data.status === 'failed') failedOrders++;
        });

        const productsSnapshot = await db.collection('products').where('active', '==', true).get();
        const activeProducts = productsSnapshot.size;

        const offersSnapshot = await db.collection('offers').where('active', '==', true).get();
        const activeOffers = offersSnapshot.size;

        let balance = null;
        if (HARAKAPAY_API_KEY) {
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
            source: 'firestore',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard stats from Firestore'
        });
    }
});

// ============================================================
// ADMIN ORDERS
// ============================================================
app.get('/api/admin/orders', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders from Firestore'
        });
    }
});

// ============================================================
// ADMIN USERS
// ============================================================
app.get('/api/admin/users', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { limit = 100 } = req.query;

        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit))
            .get();

        const users = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users from Firestore'
        });
    }
});

// ============================================================
// OFFERS
// ============================================================

// GET all offers
app.get('/api/offers', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const snapshot = await db.collection('offers')
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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get offers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch offers from Firestore'
        });
    }
});

// CREATE offer
app.post('/api/admin/offers', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { userId, productId, message, expiresAt } = req.body;

        if (!userId || !productId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and Product ID are required'
            });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found in Firestore'
            });
        }

        const productDoc = await db.collection('products').doc(productId).get();
        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
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

        // Send notification
        await createNotification(
            userId,
            '🎁 Free Offer Available!',
            message || 'You have received a free product offer. Claim it now in your dashboard!',
            'success'
        );

        res.json({
            success: true,
            message: 'Offer created successfully in Firestore',
            offerId: docRef.id,
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin create offer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create offer in Firestore'
        });
    }
});

// CLAIM offer
app.post('/api/offers/claim', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { offerId, userId } = req.body;

        if (!offerId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Offer ID and User ID are required'
            });
        }

        const offerDoc = await db.collection('offers').doc(offerId).get();

        if (!offerDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Offer not found in Firestore'
            });
        }

        const offerData = offerDoc.data();

        if (offerData.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'This offer is not for you'
            });
        }

        if (!offerData.active || offerData.claimed) {
            return res.status(400).json({
                success: false,
                error: 'Offer is no longer available'
            });
        }

        if (offerData.expiresAt && offerData.expiresAt.toDate() < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Offer has expired'
            });
        }

        const productDoc = await db.collection('products').doc(offerData.productId).get();

        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in Firestore'
            });
        }

        const product = productDoc.data();

        // Create free order
        const orderData = {
            userId: userId,
            productId: offerData.productId,
            productName: product.title,
            amount: 0,
            currency: 'TZS',
            status: 'completed',
            type: 'free',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
            offerId: offerId,
        };

        await db.collection('orders').add(orderData);

        await offerDoc.ref.update({
            claimed: true,
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Claim offer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to claim offer from Firestore'
        });
    }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

// GET all notifications
app.get('/api/notifications', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const snapshot = await db.collection('notifications')
            .orderBy('createdAt', 'desc')
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
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications from Firestore'
        });
    }
});

// CREATE notification
app.post('/api/admin/notifications', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

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

        const notifications = [];
        for (const userId of userIds) {
            const docRef = await db.collection('notifications').add({
                userId,
                title,
                message,
                type,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            notifications.push(docRef.id);
        }

        res.json({
            success: true,
            message: `Notifications sent to ${userIds.length} users in Firestore`,
            count: notifications.length,
            source: 'firestore'
        });

    } catch (error) {
        console.error('Admin send notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notifications to Firestore'
        });
    }
});

// MARK notification as read
app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const { notificationId } = req.params;

        const docRef = db.collection('notifications').doc(notificationId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found in Firestore'
            });
        }

        await docRef.update({
            read: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'Notification marked as read',
            source: 'firestore'
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
// USER PROFILE
// ============================================================
app.get('/api/user/profile', async (req, res) => {
    try {
        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Firebase not initialized'
            });
        }

        const userId = req.query.userId || 'anonymous';

        const doc = await db.collection('users').doc(userId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found in Firestore'
            });
        }

        const userData = doc.data();

        res.json({
            success: true,
            user: {
                uid: userId,
                ...userData,
                createdAt: userData.createdAt?.toDate?.() || null,
            },
            source: 'firestore'
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile from Firestore'
        });
    }
});

// ============================================================
// ADMIN BALANCE
// ============================================================
app.get('/api/admin/balance', async (req, res) => {
    try {
        if (!HARAKAPAY_API_KEY) {
            return res.status(503).json({
                success: false,
                error: 'HarakaPay API key not configured'
            });
        }

        const balance = await harakaPayGetBalance();

        res.json({
            success: true,
            ...balance,
            source: 'harakapay'
        });
    } catch (error) {
        console.error('Admin balance error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balance from HarakaPay'
        });
    }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🚀 HarakaPay Server Started Successfully');
    console.log('========================================');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔥 Firestore: ${firebaseInitialized ? '✅ Connected' : '❌ NOT CONNECTED'}`);
    console.log(`📁 Project: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
    console.log(`🔑 HarakaPay API: ${HARAKAPAY_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log('========================================');
    console.log(`🌐 Home: http://localhost:${PORT}`);
    console.log(`📄 Admin: http://localhost:${PORT}/admin-dashboard.html`);
    console.log(`📄 Login: http://localhost:${PORT}/login.html`);
    console.log(`📄 Signup: http://localhost:${PORT}/signup.html`);
    console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
    console.log('========================================');
    console.log('🔓 NO AUTHENTICATION REQUIRED');
    console.log('📊 All data from Firestore');
    console.log('💳 HarakaPay Integration: ' + (HARAKAPAY_API_KEY ? 'Enabled' : 'Disabled'));
    console.log('========================================');
});

module.exports = app;
