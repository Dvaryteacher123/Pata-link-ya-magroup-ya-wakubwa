// ============================================================
// HARAKAPAY SERVER - FIXED PHONE NUMBER FORMAT
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
function validateTanzaniaPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^0[67][0-9]{8}$/.test(cleaned) || /^255[67][0-9]{8}$/.test(cleaned);
}

// ============================================================
// IMPORTANT: Convert phone to International Format for Firebase
// ============================================================
function formatPhoneForFirebase(phone) {
    // Remove all spaces, dashes, parentheses
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // If phone starts with 0 (e.g., 0712345678)
    if (cleaned.startsWith('0')) {
        // Replace 0 with +255 (Tanzania country code)
        return '+255' + cleaned.substring(1);
    }
    
    // If phone starts with 255 (e.g., 255712345678)
    if (cleaned.startsWith('255')) {
        return '+' + cleaned;
    }
    
    // If phone already has +, return as is
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    // Default: assume Tanzania and add +255
    return '+255' + cleaned;
}

function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HP${timestamp}${random}`;
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
// AUTH ROUTES
// ============================================================

// ============================================================
// SIGNUP - FIXED PHONE FORMAT
// ============================================================
app.post('/api/auth/signup', async (req, res) => {
    try {
        console.log('📝 Signup request received:', {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            passwordLength: req.body.password ? req.body.password.length : 0
        });

        const { name, email, password, phone } = req.body;

        // Validate input
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
            console.error('❌ Firebase not initialized');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error. Firebase not initialized.'
            });
        }

        // Format phone number for Firebase (International format)
        let formattedPhone = null;
        if (phone && phone.trim()) {
            const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
            
            // Validate Tanzania phone
            if (!validateTanzaniaPhone(cleanedPhone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid Tanzania phone number. Format: 0712345678'
                });
            }
            
            // Convert to International format
            formattedPhone = formatPhoneForFirebase(cleanedPhone);
            console.log('📱 Formatted phone for Firebase:', formattedPhone);
        }

        // Check if user already exists in Firestore
        try {
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
        } catch (firestoreError) {
            console.error('❌ Firestore check error:', firestoreError);
        }

        // Create user in Firebase Auth with formatted phone
        let userRecord;
        try {
            const userData = {
                email: email,
                password: password,
                displayName: name,
            };

            // Only add phone if we have a valid formatted phone
            if (formattedPhone) {
                userData.phoneNumber = formattedPhone;
            }

            userRecord = await auth.createUser(userData);
            console.log('✅ User created in Firebase Auth:', userRecord.uid);
        } catch (authError) {
            console.error('❌ Firebase Auth createUser error:', authError);
            
            let errorMessage = 'Failed to create account';
            if (authError.code === 'auth/email-already-exists') {
                errorMessage = 'Email already registered. Please login.';
            } else if (authError.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            } else if (authError.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (authError.code === 'auth/invalid-phone-number') {
                errorMessage = 'Invalid phone number format. Please use Tanzania format: 0712345678';
            } else {
                errorMessage = authError.message || 'Failed to create user in Firebase';
            }
            
            return res.status(400).json({
                success: false,
                error: errorMessage,
                code: authError.code
            });
        }

        // Save user to Firestore
        try {
            await db.collection('users').doc(userRecord.uid).set({
                name: name,
                email: email,
                phone: phone || '',
                role: 'user',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('✅ User saved to Firestore:', userRecord.uid);
        } catch (firestoreError) {
            console.error('❌ Firestore save error:', firestoreError);
        }

        // Generate custom token
        let customToken;
        try {
            customToken = await auth.createCustomToken(userRecord.uid);
        } catch (tokenError) {
            console.error('❌ Custom token error:', tokenError);
        }

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            uid: userRecord.uid,
            token: customToken || null,
            user: {
                name: name,
                email: email,
                phone: phone || '',
                role: 'user'
            }
        });

    } catch (error) {
        console.error('❌ Signup error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create account'
        });
    }
});

// ============================================================
// LOGIN
// ============================================================
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('📝 Login request received:', req.body.email);

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        if (!firebaseInitialized || !auth || !db) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error. Firebase not initialized.'
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
        const userId = userDoc.id;
        const userData = userDoc.data();

        try {
            const userRecord = await auth.getUserByEmail(email);
            const customToken = await auth.createCustomToken(userRecord.uid);

            await db.collection('users').doc(userRecord.uid).update({
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const freshUserDoc = await db.collection('users').doc(userRecord.uid).get();
            const freshUserData = freshUserDoc.data();

            return res.json({
                success: true,
                message: 'Login successful!',
                token: customToken,
                user: {
                    uid: userRecord.uid,
                    name: freshUserData.name || '',
                    email: freshUserData.email || '',
                    phone: freshUserData.phone || '',
                    role: freshUserData.role || 'user'
                }
            });

        } catch (error) {
            console.error('❌ Firebase Auth login error:', error);
            
            if (error.code === 'auth/user-not-found') {
                return res.status(401).json({
                    success: false,
                    error: 'User not found. Please sign up first.'
                });
            }

            return res.status(401).json({
                success: false,
                error: 'Invalid credentials. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again later.'
        });
    }
});

// ============================================================
// VERIFY TOKEN
// ============================================================
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        if (!firebaseInitialized || !auth) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }

        const decodedToken = await auth.verifyIdToken(token);

        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();

        res.json({
            success: true,
            valid: true,
            user: {
                uid: decodedToken.uid,
                name: userData.name || '',
                email: userData.email || '',
                phone: userData.phone || '',
                role: userData.role || 'user'
            }
        });

    } catch (error) {
        console.error('Verify token error:', error);
        res.status(401).json({
            success: false,
            valid: false,
            error: 'Invalid or expired token'
        });
    }
});

// ============================================================
// FORGOT PASSWORD
// ============================================================
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        if (!firebaseInitialized || !auth) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }

        const resetLink = await auth.generatePasswordResetLink(email);

        res.json({
            success: true,
            message: 'Password reset link sent to your email',
            resetLink: resetLink
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        
        let errorMessage = 'Failed to send reset link';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'Email not found. Please sign up first.';
        }

        res.status(400).json({
            success: false,
            error: errorMessage
        });
    }
});

// ============================================================
// GET USER PROFILE
// ============================================================
app.get('/api/auth/profile', verifyAuthToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();

        res.json({
            success: true,
            user: {
                uid: userId,
                name: userData.name || '',
                email: userData.email || '',
                phone: userData.phone || '',
                role: userData.role || 'user',
                createdAt: userData.createdAt?.toDate?.() || null,
            }
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
// CHECK FIREBASE STATUS
// ============================================================
app.get('/api/firebase-status', (req, res) => {
    res.json({
        success: firebaseInitialized,
        message: firebaseInitialized ? 'Firebase connected' : 'Firebase not connected',
        projectId: process.env.FIREBASE_PROJECT_ID || 'not set',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'not set',
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
    });
});

// ============================================================
// HARAKAPAY API FUNCTIONS (KEEPS EXISTING CODE)
// ============================================================
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

async function harakaPayCollect(phone, amount, description, webhookUrl) {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

    try {
        const response = await axios.post(
            `${HARAKAPAY_BASE_URL}/api/v1/collect`, {
                phone: phone,
                amount: amount,
                description: description || 'Digital product purchase',
                webhook_url: webhookUrl || `${APP_BASE_URL}/api/webhook/harakapay`,
            }, {
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

async function harakaPayCheckStatus(orderId) {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

    try {
        const response = await axios.get(
            `${HARAKAPAY_BASE_URL}/api/v1/status/${orderId}`, {
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

async function harakaPayGetBalance() {
    if (!HARAKAPAY_API_KEY) {
        throw new Error('HarakaPay API key not configured');
    }

    try {
        const response = await axios.get(
            `${HARAKAPAY_BASE_URL}/api/v1/balance`, {
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
// HELPER: Fulfill Order
// ============================================================
async function fulfillOrder(orderId, userId, productId) {
    try {
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
            error: 'Failed to fetch products from Firestore',
            message: error.message
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
                error: 'Product not found in Firestore'
            });
        }

        const data = doc.data();

        if (!data.active) {
            return res.status(404).json({
                success: false,
                error: 'Product is not available'
            });
        }

        res.json({
            success: true,
            product: {
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
// ORDERS - Authenticated Users
// ============================================================
app.post('/api/orders', verifyAuthToken, async (req, res) => {
    try {
        const { productId, phone } = req.body;
        const userId = req.user.uid;

        // Format phone for validation
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
            userId,
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

        if (!isFree) {
            try {
                const paymentResponse = await harakaPayCollect(
                    cleanedPhone.startsWith('0') ? cleanedPhone.substring(1) : cleanedPhone,
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
            await fulfillOrder(docRef.id, userId, productId);
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
            error: 'Failed to create order',
            message: error.message
        });
    }
});

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

app.get('/api/orders/:orderId', verifyAuthToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.uid;

        const doc = await db.collection('orders').doc(orderId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Order not found in Firestore'
            });
        }

        const orderData = doc.data();

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

        const orderDoc = await db.collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Order not found in Firestore'
            });
        }

        const orderData = orderDoc.data();

        if (orderData.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        if (orderData.status === 'completed') {
            return res.json({
                success: true,
                status: 'completed',
                orderId: orderId,
                message: 'Payment already completed',
                source: 'firestore'
            });
        }

        if (orderData.harakaPayOrderId) {
            try {
                const statusResponse = await harakaPayCheckStatus(orderData.harakaPayOrderId);

                if (statusResponse.success && statusResponse.payment) {
                    const paymentStatus = statusResponse.payment.status;

                    if (paymentStatus === 'completed') {
                        await fulfillOrder(orderId, userId, orderData.productId);

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
// NOTIFICATIONS
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

app.put('/api/notifications/:notificationId/read', verifyAuthToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.uid;

        const doc = await db.collection('notifications').doc(notificationId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found in Firestore'
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
// HARAKAPAY WEBHOOK
// ============================================================
app.post('/api/webhook/harakapay', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

        const { order_id, status, amount } = webhookData;

        if (!order_id || !status) {
            console.error('Invalid webhook data:', webhookData);
            return res.status(400).json({ success: false, error: 'Invalid webhook data' });
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
// ADMIN ROUTES
// ============================================================

app.get('/api/admin/stats', verifyAuthToken, verifyAdmin, async (req, res) => {
    try {
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

app.delete('/api/admin/products/:productId', verifyAuthToken, verifyAdmin, async (req, res) => {
    try {
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

        const promises = userIds.map(userId =>
            createNotification(userId, title, message, type)
        );

        await Promise.all(promises);

        res.json({
            success: true,
            message: `Notifications sent to ${userIds.length} users in Firestore`,
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

app.post('/api/admin/offers', verifyAuthToken, verifyAdmin, async (req, res) => {
    try {
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

app.get('/api/admin/balance', verifyAuthToken, verifyAdmin, async (req, res) => {
    try {
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
    console.log(`🔥 Firebase: ${firebaseInitialized ? '✅ Connected' : '❌ NOT CONNECTED'}`);
    console.log(`📁 Project: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
    console.log('========================================');
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📄 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`📄 Login: http://localhost:${PORT}/login.html`);
    console.log(`📄 Signup: http://localhost:${PORT}/signup.html`);
    console.log('========================================');
    console.log('🔍 Check Firebase Status: /api/firebase-status');
    console.log('========================================');
});

module.exports = app;
