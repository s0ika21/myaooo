const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        const body = req.body;
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const order = {
            id,
            productName: body.productName,
            price: body.price,
            finalPrice: body.finalPrice || body.price,
            promoCode: body.promoCode || null,
            discount: body.discount || 0,
            accountType: body.accountType,
            accountData: body.accountData,
            telegramUserId: body.telegramUserId || null,
            telegramUsername: body.telegramUsername || null,
            status: 'awaiting_payment',
            wataLinkId: null,
            wataPaymentUrl: null,
            createdAt: new Date().toISOString()
        };
        await kv.set('order:' + id, order);
        const allOrders = (await kv.get('orders_all')) || [];
        allOrders.unshift(id);
        await kv.set('orders_all', allOrders);
        if (order.telegramUserId) {
            const userOrders = (await kv.get('orders_by_user:' + order.telegramUserId)) || [];
            userOrders.unshift(id);
            await kv.set('orders_by_user:' + order.telegramUserId, userOrders);
        }
        return res.status(201).json({ success: true, order });
    }

    if (req.method === 'GET') {
        const { telegramUserId, status } = req.query;
        let ids;
        if (telegramUserId) {
            ids = (await kv.get('orders_by_user:' + telegramUserId)) || [];
        } else {
            ids = (await kv.get('orders_all')) || [];
        }
        let orders = [];
        for (const id of ids) {
            const o = await kv.get('order:' + id);
            if (o) orders.push(o);
        }
        if (status) orders = orders.filter(o => o.status === status);
        return res.status(200).json(orders);
    }

    if (req.method === 'PATCH') {
        const { id, status } = req.body;
        const order = await kv.get('order:' + id);
        if (!order) return res.status(404).json({ error: 'Not found' });
        order.status = status;
        await kv.set('order:' + id, order);
        return res.status(200).json({ success: true, order });
    }

    return res.status(405).end();
};
