const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// Kuunganisha Firebase kwenye Server
// (Hakikisha umeweka Firebase Service Account Key yako au unaunganisha kwa usahihi)
const serviceAccount = require('./firebase-key.json'); // Faili la siri la Firebase Admin kutoka console yako

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_your_api_key_here';
const BASE_URL = 'https://harakapay.net';

// 1. Kuanzisha Malipo na Kuhifadhi 'Pending' kwenye Firebase
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount, groupName, groupLink } = req.body;
        const domain = req.protocol + '://' + req.get('host');

        const response = await axios.post(`${BASE_URL}/api/v1/collect`, {
            phone: phone,
            amount: Number(amount),
            description: `Malipo ya ${groupName}`,
            webhook_url: `${domain}/api/webhook`
        }, {
            headers: { 'X-API-Key': HARAKAPAY_API_KEY }
        });

        if (response.data.success) {
            const orderId = response.data.order_id;

            // Hifadhi oda ikiwa 'pending' kwenye Firestore database
            await db.collection('orders').doc(orderId).set({
                phone: phone,
                groupName: groupName,
                groupLink: groupLink,
                amount: amount,
                status: 'pending',
                createdAt: new Date()
            });

            res.json({ success: true, order_id: orderId, message: "Tafadhali thibitisha malipo kwenye simu yako." });
        } else {
            res.status(400).json({ success: false, error: "Imeshindwa kuanzisha malipo." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: "Hitilafu kwenye seva." });
    }
});

// 2. Webhook kutoka HarakaPay kusasisha Firebase ikifanikiwa
app.post('/api/webhook', async (req, res) => {
    const paymentData = req.body; // Inaleta order_id na status ('completed'/'failed')
    
    if (paymentData.order_id && paymentData.status) {
        const orderRef = db.collection('orders').doc(paymentData.order_id);
        
        await orderRef.update({
            status: paymentData.status // 'completed' au 'failed'
        });
    }

    res.status(200).send({ received: true });
});

// 3. Endpoint ya Mteja kukagua kama kalipiwa ili apewe link
app.get('/api/check-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const docSnap = await db.collection('orders').doc(orderId).get();

    if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Oda haionekani." });
    }

    const orderData = docSnap.data();
    
    // Kama bado ipo pending, tunaweza kupiga tena HarakaPay API kusafirisha hali halisi moja kwa moja
    if (orderData.status === 'pending') {
        try {
            const statusRes = await axios.get(`${BASE_URL}/api/v1/status/${orderId}`, {
                headers: { 'X-API-Key': HARAKAPAY_API_KEY }
            });
            
            const liveStatus = statusRes.data.payment?.status;
            if (liveStatus === 'completed') {
                await db.collection('orders').doc(orderId).update({ status: 'completed' });
                orderData.status = 'completed';
            }
        } catch (e) {
            console.error("Imeshindwa kukagua live status");
        }
    }

    res.json({
        success: true,
        status: orderData.status,
        link: orderData.status === 'completed' ? orderData.groupLink : null
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server inafanya kazi kwenye port ${PORT}`));
