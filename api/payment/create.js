const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).end();

    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await kv.get('order:' + orderId);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const WATA_API = process.env.WATA_API_URL;
    const WATA_TOKEN = process.env.WATA_API_TOKEN;
    const APP_URL = process.env.APP_URL;

    if (!WATA_API || !WATA_TOKEN) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const response = await fetch(WATA_API + '/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + WATA_TOKEN
            },
            body: JSON.stringify({
                amount: order.finalPrice,
                currency: 'RUB',
                orderId: orderId,
                description: order.productName,
                successRedirectUrl: APP_URL + '?payment=success&orderId=' + orderId,
                failRedirectUrl: APP_URL + '?payment=fail&orderId=' + orderId
            })
        });

        const wataData = await response.json();

        if (!response.ok) {
            return res.status(502).json({ error: 'Payment service error', details: wataData });
        }

        order.wataLinkId = wataData.id;
        order.wataPaymentUrl = wataData.url;
        await kv.set('order:' + orderId, order);

        return res.status(200).json({
            success: true,
            paymentUrl: wataData.url,
            wataLinkId: wataData.id
        });
    } catch (err) {
        return res.status(502).json({ error: 'Failed to contact payment service', details: err.message });
    }
};
