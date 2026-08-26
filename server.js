const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Badilisha hapa uweke HarakaPay API Key yako halisi (au iweke kwenye Render Environment Variables)
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_your_api_key_here';
const BASE_URL = 'https://harakapay.net';

// 1. Endpoint ya Kuanzisha Malipo (Initiate Payment)
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount, groupName } = req.body;
        const domain = req.protocol + '://' + req.get('host');
        const webhook_url = `${domain}/api/webhook`;

        const response = await axios.post(`${BASE_URL}/api/v1/collect`, {
            phone: phone,
            amount: Number(amount),
            description: `Malipo ya ${groupName || 'Group la WhatsApp'}`,
            webhook_url: webhook_url
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': HARAKAPAY_API_KEY
            }
        });

        if (response.data.success) {
            res.json({
                success: true,
                order_id: response.data.order_id,
                message: "Ombi la malipo limetumwa kwenye simu yako. Tafadhali weka PIN."
            });
        } else {
            res.status(400).json({ success: false, error: "Imeshindwa kuanzisha malipo na HarakaPay." });
        }

    } catch (error) {
        console.error("Hitilafu ya malipo:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Hitilafu imetokea kwenye seva." });
    }
});

// 2. Endpoint ya Kukagua Hali ya Malipo (Check Status)
app.get('/api/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const response = await axios.get(`${BASE_URL}/api/v1/status/${orderId}`, {
            headers: {
                'X-API-Key': HARAKAPAY_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Hitilafu ya kuangalia status:", error.message);
        res.status(500).json({ success: false, error: "Imeshindwa kukagua hali ya malipo." });
    }
});

// 3. Webhook Endpoint (HarakaPay inatuma taarifa hapa malipo yanapobadilika)
app.post('/api/webhook', (req, res) => {
    const paymentData = req.body;
    console.log("Webhook imepokelewa kutoka HarakaPay:", paymentData);

    // Hapa unaweza kuona kama paymentData.status ni 'completed'
    if (paymentData.status === 'completed') {
        console.log(`Malipo ya Oda ${paymentData.order_id} yamekamilika!`);
    }

    res.status(200).send({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server inafanya kazi vizuri kwenye port ${PORT}`);
});

