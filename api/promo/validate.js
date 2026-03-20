const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).end();

    const { code, price } = req.body;
    if (!code || !price) {
        return res.status(400).json({ error: 'code and price are required' });
    }

    const upperCode = code.toUpperCase();
    const promo = await kv.get('promo:' + upperCode);

    if (!promo) {
        return res.status(400).json({ error: 'Promo code not found' });
    }

    if (!promo.active) {
        return res.status(400).json({ error: 'Promo code is inactive' });
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Promo code has expired' });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return res.status(400).json({ error: 'Promo code usage limit exceeded' });
    }

    let discount;
    if (promo.discountType === 'percent') {
        discount = Math.round(price * promo.discountValue / 100);
    } else {
        discount = Math.min(promo.discountValue, price);
    }

    const finalPrice = price - discount;

    return res.status(200).json({
        valid: true,
        discount,
        finalPrice,
        discountType: promo.discountType,
        discountValue: promo.discountValue
    });
};
