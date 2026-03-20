const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const codes = (await kv.get('promos_all')) || [];
        const promos = [];
        for (const code of codes) {
            const p = await kv.get('promo:' + code);
            if (p) promos.push(p);
        }
        return res.status(200).json(promos);
    }

    if (req.method === 'POST') {
        const { code, discountType, discountValue, maxUses, expiresAt, active } = req.body;
        if (!code || !discountType || !discountValue) {
            return res.status(400).json({ error: 'code, discountType, and discountValue are required' });
        }
        const promo = {
            code: code.toUpperCase(),
            discountType,
            discountValue,
            maxUses: maxUses || null,
            usedCount: 0,
            expiresAt: expiresAt || null,
            active: active !== undefined ? active : true,
            createdAt: new Date().toISOString()
        };
        await kv.set('promo:' + promo.code, promo);
        const allCodes = (await kv.get('promos_all')) || [];
        if (!allCodes.includes(promo.code)) {
            allCodes.push(promo.code);
            await kv.set('promos_all', allCodes);
        }
        return res.status(201).json({ success: true, promo });
    }

    if (req.method === 'DELETE') {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'code is required' });
        const upperCode = code.toUpperCase();
        await kv.del('promo:' + upperCode);
        const allCodes = (await kv.get('promos_all')) || [];
        const filtered = allCodes.filter(c => c !== upperCode);
        await kv.set('promos_all', filtered);
        return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
        const { code, ...fieldsToUpdate } = req.body;
        if (!code) return res.status(400).json({ error: 'code is required' });
        const upperCode = code.toUpperCase();
        const promo = await kv.get('promo:' + upperCode);
        if (!promo) return res.status(404).json({ error: 'Promo not found' });
        Object.assign(promo, fieldsToUpdate);
        promo.code = upperCode; // ensure code stays uppercase
        await kv.set('promo:' + upperCode, promo);
        return res.status(200).json({ success: true, promo });
    }

    return res.status(405).end();
};
