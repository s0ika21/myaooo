const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const order = await kv.get('order:' + orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // If already updated by webhook
    if (order.status === 'paid') return res.status(200).json({ status: 'paid' });

    // Poll Wata API for transaction status
    const WATA_API = process.env.WATA_API_URL;
    const WATA_TOKEN = process.env.WATA_API_TOKEN;

    if (!WATA_API || !WATA_TOKEN) {
        return res.status(200).json({ status: order.status });
    }

    try {
        const response = await fetch(WATA_API + '/transactions?orderId=' + encodeURIComponent(orderId), {
            headers: { 'Authorization': 'Bearer ' + WATA_TOKEN }
        });
        const data = await response.json();
        const items = data.items || data;

        if (Array.isArray(items) && items.length > 0) {
            const tx = items[0];
            if (tx.status === 'Paid') {
                order.status = 'paid';
                await kv.set('order:' + orderId, order);
                // Increment promo usedCount
                if (order.promoCode) {
                    const promo = await kv.get('promo:' + order.promoCode.toUpperCase());
                    if (promo) {
                        promo.usedCount = (promo.usedCount || 0) + 1;
                        await kv.set('promo:' + order.promoCode.toUpperCase(), promo);
                    }
                }
                return res.status(200).json({ status: 'paid' });
            } else if (tx.status === 'Declined') {
                return res.status(200).json({ status: 'declined' });
            }
        }

        return res.status(200).json({ status: 'pending' });
    } catch (err) {
        return res.status(200).json({ status: order.status });
    }
};
