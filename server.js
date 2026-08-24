// ============================================================
// HARAKAPAY SERVER - NO AUTHENTICATION REQUIRED
// ============================================================
// All data from Firestore - No login required
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
// SERVE STATIC HTML FILES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
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

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        firebase: firebaseInitialized ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ADMIN STATS - NO AUTH REQUIRED
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
// PRODUCTS - NO AUTH REQUIRED
// ============================================================

// GET all products
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

// GET single product (public)
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

// GET products (public)
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
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products from Firestore'
        });
    }
});

// ============================================================
// ORDERS - NO AUTH REQUIRED
// ============================================================

// GET all orders (admin)
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
// USERS - NO AUTH REQUIRED
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
// OFFERS - NO AUTH REQUIRED
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

// ============================================================
// NOTIFICATIONS - NO AUTH REQUIRED
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

// ============================================================
// AUTH ROUTES (Still available for login/signup if needed)
// ============================================================
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

        if (!firebaseInitialized || !db) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error. Firebase not initialized.'
            });
        }

        // Create user in Firebase Auth
        const adminAuth = admin.auth();
        const userRecord = await adminAuth.createUser({
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

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Simple login check - find user in Firestore
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
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
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
    console.log('========================================');
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📄 Admin Dashboard: http://localhost:${PORT}/admin-dashboard.html`);
    console.log(`📄 Login: http://localhost:${PORT}/login.html`);
    console.log(`📄 Signup: http://localhost:${PORT}/signup.html`);
    console.log('========================================');
    console.log('🔓 NO AUTHENTICATION REQUIRED - All endpoints open');
    console.log('========================================');
});

module.exports = app;
