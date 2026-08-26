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
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// SERVE STATIC FILES (HTML, CSS, JS)
// ============================================================
// Hii inaruhusu server isome faili zote za HTML kwenye folder root
app.use(express.static(__dirname));

// ============================================================
// ROUTES ZA HTML PAGES
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
// FIREBASE ADMIN INITIALIZATION
// ============================================================
let db = null;

try {
    // Tumia environment variables kwa Render
    const serviceAccount = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };

    // Check if all required fields exist
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
    webhookUrl: process.env.WEBHOOK_URL || 'https://your-domain.onrender.com/webhook/harakapay',
    timeout: 30000
};

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
        return response.data;
    } catch (error) {
        console.error('HarakaPay collect error:', error.response?.data || error.message);
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
// FIREBASE FUNCTIONS (if Firebase is available)
// ============================================================

async function saveOrder(orderData) {
    if (!db) throw new Error('Firebase not initialized');
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
        firebase: db ? 'connected' : 'not connected'
    });
});

// ============================================================
// 1. INITIATE PAYMENT
// ============================================================
app.post('/api/payment/initiate', async (req, res) => {
    try {
        const { phone, amount, description, userId, productName, productId, clientName } = req.body;

        if (!phone || !amount || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Phone, amount, and userId are required'
            });
        }

        if (amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum amount is 100 TZS'
            });
        }

        const reference = generateReference();
        const paymentResult = await collectPayment(phone, amount, description, reference);

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                message: paymentResult.message || 'Payment initiation failed'
            });
        }

        // Save order if Firebase is available
        let orderId = null;
        if (db) {
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
            orderId = await saveOrder(orderData);

            await sendNotification(
                userId,
                '💰 Ombi la malipo limetumwa!',
                `Malipo ya TZS ${amount} yametumwa kwa simu yako. Thibitisha kwenye simu.`
            );

            await addChatMessage(
                'system',
                'Mfumo',
                `💰 ${clientName || 'Mteja'} ameomba kununua ${productName || 'Group'} - TZS ${amount}. Malipo yanachakatwa...`
            );
        }

        res.json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
                orderId: orderId,
                paymentReference: paymentResult.order_id,
                amount: paymentResult.amount,
                netAmount: paymentResult.net_amount,
                fee: paymentResult.fee,
                phone: phone
            }
        });

    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Payment initiation failed'
        });
    }
});

// ============================================================
// 2. CHECK PAYMENT STATUS
// ============================================================
app.get('/api/payment/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const statusResult = await checkPaymentStatus(orderId);

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
    try {
        const webhookData = req.body;
        console.log('📥 Webhook received:', webhookData);

        const { order_id, status, amount, net_amount, fee_amount, completed_at } = webhookData;

        if (!order_id) {
            console.warn('Webhook: Missing order_id');
            return res.status(400).json({ success: false, message: 'Missing order_id' });
        }

        if (db) {
            const orderDoc = await db.collection('orders')
                .where('paymentReference', '==', order_id)
                .limit(1)
                .get();

            if (orderDoc.empty) {
                console.warn(`Webhook: Order ${order_id} not found`);
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const orderDocId = orderDoc.docs[0].id;
            const orderData = orderDoc.docs[0].data();

            if (status === 'completed') {
                await updateOrderStatus(orderDocId, 'Completed', webhookData);

                if (orderData.userId) {
                    await sendNotification(
                        orderData.userId,
                        '✅ Malipo yamethibitishwa!',
                        `Malipo yako ya TZS ${amount} yamekamilika. Sasa unaweza kujiunga na group!`
                    );

                    await addChatMessage(
                        'system',
                        'Mfumo',
                        `✅ ${orderData.clientName || 'Mteja'} amekamilisha malipo ya ${orderData.productName || 'Group'} - TZS ${amount}`
                    );
                }

                console.log(`✅ Webhook: Order ${order_id} completed successfully`);

            } else if (status === 'failed') {
                await updateOrderStatus(orderDocId, 'Failed', webhookData);

                if (orderData.userId) {
                    await sendNotification(
                        orderData.userId,
                        '❌ Malipo yameshindikana',
                        `Malipo yako ya TZS ${amount} hayajakamilika. Jaribu tena.`,
                        'times-circle'
                    );
                }

                console.log(`❌ Webhook: Order ${order_id} failed`);
            } else {
                console.log(`⏳ Webhook: Order ${order_id} status: ${status}`);
            }
        } else {
            console.log(`⚠️ Firebase not available. Webhook data:`, webhookData);
        }

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Webhook error:', error);
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
// 5. SEND NOTIFICATION TO USER (Admin)
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

        if (db) {
            await sendNotification(userId, title, message, icon || 'bell');
        }

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
// 6. GET ORDER DETAILS
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
// CATCH-ALL ROUTE - Serve index.html for unknown routes
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 HarakaPay API: ${HARAKAPAY_CONFIG.baseUrl}`);
    console.log(`🔗 Webhook URL: ${HARAKAPAY_CONFIG.webhookUrl}`);
    console.log(`📦 Firebase: ${db ? '✅ Connected' : '❌ Not connected'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Serving files from: ${__dirname}`);
});

module.exports = app;
