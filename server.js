require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Inaruhusu server kusoma mafaili yaliyopo kwenye folda moja (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.HARAKAPAY_API_KEY;
const BASE_URL = 'https://harakapay.net';

// 1. Routes za kufungua kurasa zote za tovuti yako moja kwa moja
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/setting', (req, res) => {
    res.sendFile(path.join(__dirname, 'setting.html'));
});

// 2. Endpoint ya malipo kwenda HarakaPay
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount, description, webhook_url } = req.body;

        const response = await axios.post(`${BASE_URL}/api/v1/collect`, {
            phone: phone,
            amount: amount,
            description: description,
            webhook_url: webhook_url
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Hitilafu ya HarakaPay:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: 'Imeshindikana kuunganisha na HarakaPay' });
    }
});

// 3. Webhook ya kupokea majibu ya malipo kutoka HarakaPay
app.post('/webhook', (req, res) => {
    const paymentData = req.body;
    console.log("Webhook imepokelewa kutoka HarakaPay:", paymentData);

    if (paymentData.status === 'completed') {
        // Hapa unaweza kusasisha status kwenye Firebase kama oda imelipiwa
    }

    res.status(200).send('Webhook imepokelewa vizuri');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server inafanya kazi kwenye http://localhost:${PORT}`);
});
