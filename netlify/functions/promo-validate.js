const { getStore } = require("@netlify/blobs");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: typeof body === "string" ? body : JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return cors(200, "");
    if (event.httpMethod !== "POST") return cors(405, { error: "Method not allowed" });

    const { code, price } = JSON.parse(event.body);
    if (!code || !price) {
        return cors(400, { error: "code and price are required" });
    }

    const store = getStore("promos");
    const upperCode = code.toUpperCase();
    let promo;
    try { promo = await store.get(upperCode, { type: "json" }); } catch {}

    if (!promo) return cors(400, { error: "Promo code not found" });
    if (!promo.active) return cors(400, { error: "Promo code is inactive" });
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return cors(400, { error: "Promo code has expired" });
    }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return cors(400, { error: "Promo code usage limit exceeded" });
    }

    let discount;
    if (promo.discountType === "percent") {
        discount = Math.round(price * promo.discountValue / 100);
    } else {
        discount = Math.min(promo.discountValue, price);
    }

    const finalPrice = price - discount;

    return cors(200, {
        valid: true,
        discount,
        finalPrice,
        discountType: promo.discountType,
        discountValue: promo.discountValue
    });
};
