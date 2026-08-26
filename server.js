// ============================================================
// SERVER.JS - DVARY GROUPS COMPLETE SERVER
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');

// ============================================================
// INITIALIZE EXPRESS
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// LOGGING MIDDLEWARE
// ============================================================
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('📦 Body:', req.body);
    }
    next();
});

// ============================================================
// SERVE STATIC FILES
// ============================================================
app.use(express.static(__dirname));

// ============================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================
let db = null;

try {
    const serviceAccount = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || 'dvary-9a7d0',
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
        private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
        client_id: process.env.FIREBASE_CLIENT_ID || '',
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || '',
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };

    if (serviceAccount.private_key && serviceAccount.client_email) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://dvary-9a7d0-default-rtdb.firebaseio.com'
        });
        db = admin.firestore();
        console.log('✅ Firebase connected successfully');
    } else {
        console.warn('⚠️ Firebase credentials incomplete. Running without Firebase.');
    }
} catch (error) {
    console.warn('⚠️ Firebase initialization skipped:', error.message);
}

// ============================================================
// HARAKAPAY CONFIGURATION
// ============================================================
const HARAKAPAY_CONFIG = {
    apiKey: process.env.HARAKAPAY_API_KEY || 'hpk_your_api_key_here',
    baseUrl: process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net',
    webhookUrl: process.env.WEBHOOK_URL || 'https://wakubwa.onrender.com/webhook/harakapay',
    timeout: 30000
};

console.log('🔑 HarakaPay API Key:', HARAKAPAY_CONFIG.apiKey ? '✅ Set' : '❌ Not Set');
console.log('🔗 Webhook URL:', HARAKAPAY_CONFIG.webhookUrl);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatPhoneForHarakaPay(phone) {
    let cleaned = phone.replace(/\s/g, '');
    if (cleaned.startsWith('255')) {
        cleaned = '0' + cleaned.substring(3);
    }
    if (cleaned.startsWith('+255')) {
        cleaned = '0' + cleaned.substring(4);
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return cleaned;
    }
    if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        return '0' + cleaned;
    }
    return cleaned;
}

function generateReference() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DV${timestamp}${random}`;
}

// ============================================================
// HARAKAPAY API FUNCTIONS
// ============================================================

async function collectPayment(phone, amount, description, reference) {
    const formattedPhone = formatPhoneForHarakaPay(phone);
    
    console.log('📤 Sending to HarakaPay:');
    console.log('   Phone:', formattedPhone);
    console.log('   Amount:', amount);
    console.log('   Description:', description);
    console.log('   Reference:', reference);
    
    try {
        const response = await axios.post(
            `${HARAKAPAY_CONFIG.baseUrl}/api/v1/collect`,
            {
                phone: formattedPhone,
                amount: amount,
                description: description || 'Dvary Groups - Link Purchase',
                webhook_url: HARAKAPAY_CONFIG.webhookUrl,
                reference: reference
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': HARAKAPAY_CONFIG.apiKey
                },
                timeout: HARAKAPAY_CONFIG.timeout
            }
        );
        
        console.log('✅ HarakaPay Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ HarakaPay collect error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Payment initiation failed');
    }
}

async function checkPaymentStatus(orderId) {
    try {
        const response = await axios.get(
            `${HARAKAPAY_CONFIG.baseUrl}/api/v1/status/${orderId}`,
            {
                headers: {
                    'X-API-Key': HARAKAPAY_CONFIG.apiKey
                },
                timeout: HARAKAPAY_CONFIG.timeout
            }
        );
        return response.data;
    } catch (error) {
        console.error('HarakaPay status check error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Status check failed');
    }
}

async function getBalance() {
    try {
        const response = await axios.get(
            `${HARAKAPAY_CONFIG.baseUrl}/api/v1/balance`,
            {
                headers: {
                    'X-API-Key': HARAKAPAY_CONFIG.apiKey
                },
                timeout: HARAKAPAY_CONFIG.timeout
            }
        );
        return response.data;
    } catch (error) {
        console.error('HarakaPay balance error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Balance check failed');
    }
}

// ============================================================
// FIREBASE FUNCTIONS
// ============================================================

async function saveOrder(orderData) {
    if (!db) {
        console.warn('⚠️ Firebase not available, skipping save');
        return 'mock_order_' + Date.now();
    }
    try {
        const docRef = await db.collection('orders').add({
            ...orderData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Save order error:', error);
        throw new Error('Failed to save order');
    }
}

async function updateOrderStatus(orderId, status, paymentData) {
    if (!db) return false;
    try {
        await db.collection('orders').doc(orderId).update({
            orderStatus: status,
            paymentStatus: status === 'completed' ? 'Paid' : 'Failed',
            paymentData: paymentData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Update order error:', error);
        return false;
    }
}

async function sendNotification(userId, title, message, icon = 'bell') {
    if (!db) return false;
    try {
        await db.collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            icon: icon,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Notification error:', error);
        return false;
    }
}

async function addChatMessage(userId, userName, message) {
    if (!db) return false;
    try {
        await db.collection('chat').add({
            userId: userId,
            userName: userName || 'Mfumo',
            userAvatar: null,
            message: message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Chat message error:', error);
        return false;
    }
}

// ============================================================
// API ROUTES
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Dvary Payment Server',
        environment: process.env.NODE_ENV || 'development',
        firebase: db ? 'connected' : 'not connected',
        harakapay: HARAKAPAY_CONFIG.apiKey ? 'configured' : 'not configured'
    });
});

// ============================================================
// 1. INITIATE PAYMENT - KUNA MAELEZO YOTE
// ============================================================
app.post('/api/payment/initiate', async (req, res) => {
    console.log('='.repeat(50));
    console.log('💳 PAYMENT INITIATE REQUEST');
    console.log('='.repeat(50));
    console.log('📦 Body:', req.body);
    
    try {
        const { phone, amount, description, userId, productName, productId, clientName } = req.body;

        // Validate
        if (!phone || !amount || !userId) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Phone, amount, and userId are required'
            });
        }

        if (amount < 100) {
            console.log('❌ Validation failed: Amount too low');
            return res.status(400).json({
                success: false,
                message: 'Minimum amount is 100 TZS'
            });
        }

        console.log('✅ Validation passed');
        console.log('📱 Phone:', phone);
        console.log('💰 Amount:', amount);
        console.log('👤 User:', userId);
        console.log('📦 Product:', productName);

        // Generate reference
        const reference = generateReference();
        console.log('🔑 Reference:', reference);

        // ============================================================
        // STEP 1: CALL HARAKAPAY API
        // ============================================================
        console.log('📤 Calling HarakaPay API...');
        
        try {
            var paymentResult = await collectPayment(phone, amount, description || productName || 'Dvary Group Purchase', reference);
            console.log('✅ HarakaPay Response:', paymentResult);
        } catch (harakaError) {
            console.error('❌ HarakaPay Error:', harakaError.message);
            
            // Return error to frontend
            return res.status(400).json({
                success: false,
                message: harakaError.message || 'Payment initiation failed. Please try again.',
                error: harakaError.message
            });
        }

        if (!paymentResult.success) {
            console.log('❌ HarakaPay returned error:', paymentResult.message);
            return res.status(400).json({
                success: false,
                message: paymentResult.message || 'Payment initiation failed'
            });
        }

        console.log('✅ Payment initiated successfully with HarakaPay');
        console.log('📋 Order ID:', paymentResult.order_id);

        // ============================================================
        // STEP 2: SAVE ORDER TO FIRESTORE
        // ============================================================
        const orderData = {
            userId: userId,
            productId: productId || 'unknown',
            productName: productName || 'WhatsApp Group',
            amount: amount,
            paymentStatus: 'Pending',
            orderStatus: 'Pending',
            paymentReference: paymentResult.order_id || reference,
            purchaseLink: '',
            clientPhone: phone,
            clientName: clientName || 'Mteja',
            harakaPayData: {
                order_id: paymentResult.order_id,
                net_amount: paymentResult.net_amount,
                fee: paymentResult.fee,
                initiated_at: new Date().toISOString()
            }
        };

        console.log('💾 Saving order to Firestore...');
        const orderId = await saveOrder(orderData);
        console.log('✅ Order saved with ID:', orderId);

        // ============================================================
        // STEP 3: SEND NOTIFICATION TO USER
        // ============================================================
        console.log('🔔 Sending notification to user...');
        await sendNotification(
            userId,
            '💰 Ombi la malipo limetumwa!',
            `Malipo ya TZS ${amount} yametumwa kwa simu yako. Thibitisha kwenye simu yako.`,
            'money-bill-wave'
        );
        console.log('✅ Notification sent');

        // ============================================================
        // STEP 4: ADD CHAT MESSAGE
        // ============================================================
        console.log('💬 Adding chat message...');
        await addChatMessage(
            'system',
            'Mfumo',
            `💰 ${clientName || 'Mteja'} ameomba kununua ${productName || 'Group'} - TZS ${amount}. Malipo yanachakatwa...`
        );
        console.log('✅ Chat message added');

        // ============================================================
        // STEP 5: RETURN SUCCESS RESPONSE
        // ============================================================
        console.log('✅ Payment process completed successfully');
        console.log('='.repeat(50));

        res.json({
            success: true,
            message: 'Payment initiated successfully. Check your phone for USSD push.',
            data: {
                orderId: orderId,
                paymentReference: paymentResult.order_id,
                amount: paymentResult.amount,
                netAmount: paymentResult.net_amount,
                fee: paymentResult.fee,
                phone: phone,
                message: paymentResult.message || 'USSD push sent to your phone'
            }
        });

    } catch (error) {
        console.error('❌ Payment initiation error:', error);
        console.log('='.repeat(50));
        res.status(500).json({
            success: false,
            message: error.message || 'Payment initiation failed. Please try again.',
            error: error.message
        });
    }
});

// ============================================================
// 2. CHECK PAYMENT STATUS
// ============================================================
app.get('/api/payment/status/:orderId', async (req, res) => {
    console.log('📊 Status check for:', req.params.orderId);
    
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Check status with HarakaPay
        const statusResult = await checkPaymentStatus(orderId);
        console.log('📊 Status result:', statusResult);

        // Get order from Firestore
        let orderData = null;
        let orderDocId = null;

        if (db) {
            const orderDoc = await db.collection('orders')
                .where('paymentReference', '==', orderId)
                .limit(1)
                .get();

            if (!orderDoc.empty) {
                orderDocId = orderDoc.docs[0].id;
                orderData = orderDoc.docs[0].data();
            }
        }

        // If payment is completed
        if (statusResult.success && statusResult.payment?.status === 'completed') {
            if (orderDocId) {
                await updateOrderStatus(orderDocId, 'Completed', statusResult.payment);

                if (orderData && orderData.userId) {
                    await sendNotification(
                        orderData.userId,
                        '✅ Malipo yamethibitishwa!',
                        `Malipo yako ya TZS ${orderData.amount} yamekamilika. Sasa unaweza kujiunga na group!`
                    );

                    await addChatMessage(
                        'system',
                        'Mfumo',
                        `✅ ${orderData.clientName || 'Mteja'} amekamilisha malipo ya ${orderData.productName || 'Group'} - TZS ${orderData.amount}`
                    );
                }
            }
        }

        res.json({
            success: true,
            data: {
                payment: statusResult.payment || statusResult,
                order: orderData,
                orderId: orderDocId
            }
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Status check failed'
        });
    }
});

// ============================================================
// 3. WEBHOOK - HARAKAPAY CALLBACK
// ============================================================
app.post('/webhook/harakapay', async (req, res) => {
    console.log('='.repeat(50));
    console.log('📥 WEBHOOK RECEIVED FROM HARAKAPAY');
    console.log('='.repeat(50));
    console.log('📦 Webhook Data:', req.body);

    try {
        const webhookData = req.body;
        const { order_id, status, amount, net_amount, fee_amount, completed_at } = webhookData;

        if (!order_id) {
            console.warn('⚠️ Webhook: Missing order_id');
            return res.status(400).json({ success: false, message: 'Missing order_id' });
        }

        // Find order in Firestore
        if (db) {
            const orderDoc = await db.collection('orders')
                .where('paymentReference', '==', order_id)
                .limit(1)
                .get();

            if (orderDoc.empty) {
                console.warn(`⚠️ Webhook: Order ${order_id} not found in Firestore`);
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const orderDocId = orderDoc.docs[0].id;
            const orderData = orderDoc.docs[0].data();

            console.log('📋 Found order:', orderDocId);
            console.log('📋 Order data:', orderData);

            if (status === 'completed') {
                console.log('✅ Payment completed! Updating order...');
                
                await updateOrderStatus(orderDocId, 'Completed', webhookData);

                if (orderData.userId) {
                    await sendNotification(
                        orderData.userId,
                        '✅ Malipo yamethibitishwa!',
                        `Malipo yako ya TZS ${amount} yamekamilika. Sasa unaweza kujiunga na group!`,
                        'check-circle'
                    );

                    await addChatMessage(
                        'system',
                        'Mfumo',
                        `✅ ${orderData.clientName || 'Mteja'} amekamilisha malipo ya ${orderData.productName || 'Group'} - TZS ${amount}`
                    );
                }

                console.log('✅ Order completed successfully');

            } else if (status === 'failed') {
                console.log('❌ Payment failed! Updating order...');
                
                await updateOrderStatus(orderDocId, 'Failed', webhookData);

                if (orderData.userId) {
                    await sendNotification(
                        orderData.userId,
                        '❌ Malipo yameshindikana',
                        `Malipo yako ya TZS ${amount} hayajakamilika. Jaribu tena.`,
                        'times-circle'
                    );
                }

                console.log('❌ Order marked as failed');
            } else {
                console.log(`⏳ Order status: ${status} (pending)`);
            }
        } else {
            console.log('⚠️ Firebase not available, but webhook received:', webhookData);
        }

        console.log('✅ Webhook processed successfully');
        console.log('='.repeat(50));

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        console.log('='.repeat(50));
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// 4. GET BALANCE
// ============================================================
app.get('/api/payment/balance', async (req, res) => {
    try {
        const balance = await getBalance();
        res.json({
            success: true,
            data: balance
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Balance check failed'
        });
    }
});

// ============================================================
// 5. SEND NOTIFICATION (Admin)
// ============================================================
app.post('/api/notification/send', async (req, res) => {
    try {
        const { userId, title, message, icon } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({
                success: false,
                message: 'userId, title, and message are required'
            });
        }

        await sendNotification(userId, title, message, icon || 'bell');

        res.json({
            success: true,
            message: 'Notification sent successfully'
        });

    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send notification'
        });
    }
});

// ============================================================
// 6. GET ORDER
// ============================================================
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                message: 'Firebase not available'
            });
        }

        const orderDoc = await db.collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: orderDoc.id,
                ...orderDoc.data()
            }
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get order'
        });
    }
});

// ============================================================
// 7. GET USER ORDERS
// ============================================================
app.get('/api/user/:userId/orders', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                message: 'Firebase not available'
            });
        }

        const ordersSnapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const orders = [];
        ordersSnapshot.forEach(doc => {
            orders.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            data: orders
        });

    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get orders'
        });
    }
});

// ============================================================
// SERVE HTML PAGES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ============================================================
// CATCH-ALL ROUTE
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🚀 SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`📡 Port: ${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`📡 HarakaPay API: ${HARAKAPAY_CONFIG.baseUrl}`);
    console.log(`🔗 Webhook URL: ${HARAKAPAY_CONFIG.webhookUrl}`);
    console.log(`📦 Firebase: ${db ? '✅ Connected' : '❌ Not connected'}`);
    console.log(`🔑 HarakaPay API Key: ${HARAKAPAY_CONFIG.apiKey ? '✅ Set' : '❌ Not Set'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(50));
    console.log('📋 Available Endpoints:');
    console.log('   GET  /api/health');
    console.log('   POST /api/payment/initiate');
    console.log('   GET  /api/payment/status/:orderId');
    console.log('   POST /webhook/harakapay');
    console.log('   GET  /api/payment/balance');
    console.log('   POST /api/notification/send');
    console.log('   GET  /api/order/:orderId');
    console.log('   GET  /api/user/:userId/orders');
    console.log('='.repeat(50));
});

module.exports = app;
