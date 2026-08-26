// ============================================================
// SERVER.JS - HARAKAPAY PAYMENT INTEGRATION
// ============================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');

// ============================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================
// Tumia environment variables kwa Render
const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

// ============================================================
// HARAKAPAY CONFIGURATION - KUTOKA ENVIRONMENT VARIABLES
// ============================================================
const HARAKAPAY_CONFIG = {
    apiKey: process.env.HARAKAPAY_API_KEY,
    baseUrl: process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net',
    webhookUrl: process.env.WEBHOOK_URL || 'https://your-domain.com/webhook/harakapay',
    timeout: 30000
};

// ============================================================
// EXPRESS SERVER
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5500'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Format phone number for HarakaPay (starts with 0)
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

// Generate unique reference
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
// FIREBASE FUNCTIONS
// ============================================================

async function saveOrder(orderData) {
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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Dvary Payment Server',
        environment: process.env.NODE_ENV || 'development'
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

        const orderId = await saveOrder(orderData);

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

        const orderDoc = await db.collection('orders')
            .where('paymentReference', '==', orderId)
            .limit(1)
            .get();

        let orderData = null;
        let orderDocId = null;

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
    console.log(`📦 Firebase connected: ${admin.apps.length > 0 ? '✅' : '❌'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
