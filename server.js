require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');

// Kusoma Firebase Service Account kutoka kwenye Environment Variables aufaili la JSON
// Hakikisha umeweka FIREBASE_SERVICE_ACCOUNT kwenye Render (Environmental Variables)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // Kama unatumia faili la local la JSON
    serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());

// Inaruhusu server kusoma mafaili yaliyopo kwenye folda moja (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.HARAKAPAY_API_KEY;
const BASE_URL = 'https://harakapay.net';

// 1. Routes za kufungua kurasa zako moja kwa moja
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 2. Endpoint ya malipo kwenda HarakaPay na kuhifadhi 'pending' kwenye Firestore
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount, description, userId, groupLinkId } = req.body;

        // Webhook URL ya server yako ya Render (Badilisha domain iwe yako halisi au tumia link ya Render)
        const webhook_url = `${req.protocol}://${req.get('host')}/webhook`;

        const response = await axios.post(`${BASE_URL}/api/v1/collect`, {
            phone: phone,
            amount: Number(amount),
            description: description,
            webhook_url: webhook_url
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            }
        });

        const paymentResult = response.data;

        if (paymentResult.success) {
            const orderId = paymentResult.order_id;

            // Hifadhi kwenye Firestore ikiwa 'pending'
            await db.collection('orders').doc(orderId).set({
                orderId: orderId,
                userId: userId || 'anonymous',
                phone: phone,
                amount: amount,
                status: 'pending', // Inaanzakiwa pending kama ulivyotaka
                groupLinkId: groupLinkId || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json(paymentResult);
    } catch (error) {
        console.error("Hitilafu ya HarakaPay:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: 'Imeshindikana kuunganisha na HarakaPay' });
    }
});

// 3. Webhook ya kupokea majibu ya malipo kutoka HarakaPay na kusasisha Firestore
app.post('/webhook', async (req, res) => {
    try {
        const paymentData = req.body;
        console.log("Webhook imepokelewa kutoka HarakaPay:", paymentData);

        const orderId = paymentData.order_id;
        const status = paymentData.status; // 'completed' au 'failed'

        if (orderId) {
            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (orderDoc.exists) {
                if (status === 'completed') {
                    // Badilisha kuwa success kwenye Firestore
                    await orderRef.update({
                        status: 'success',
                        completedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`Oda ${orderId} imekamilishwa (success) na imehifadhiwa Firestore.`);
                } else if (status === 'failed') {
                    await orderRef.update({
                        status: 'failed'
                    });
                    console.log(`Oda ${orderId} imefeli (failed).`);
                }
            }
        }

        // Mwisho wa maombi ya Webhook lazima itume status 200 kama ilivyoainishwa kwenye nyaraka za HarakaPay
        res.status(200).send('Webhook imepokelewa vizuri');
    } catch (err) {
        console.error("Hitilafu kwenye Webhook:", err);
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server inafanya kazi kwenye http://localhost:${PORT}`);
});

