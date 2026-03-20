const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).end();

    const { orderId, transactionStatus } = req.body;

    if (!orderId) {
        // Always return 200 for Wata
        return res.status(200).json({ received: true, error: 'No orderId' });
    }

    const order = await kv.get('order:' + orderId);
    if (!order) {
        return res.status(200).json({ received: true, error: 'Order not found' });
    }

    if (transactionStatus === 'Paid') {
        order.status = 'paid';
        await kv.set('order:' + orderId, order);

        // Increment promo usedCount if a promo code was used
        if (order.promoCode) {
            const promo = await kv.get('promo:' + order.promoCode.toUpperCase());
            if (promo) {
                promo.usedCount = (promo.usedCount || 0) + 1;
                await kv.set('promo:' + order.promoCode.toUpperCase(), promo);
            }
        }
    }
    // If transactionStatus === 'Declined', keep awaiting_payment (no change needed)

    return res.status(200).json({ received: true });
};
