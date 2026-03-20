const { createClient } = require("@supabase/supabase-js");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") return cors(200, "");
        if (event.httpMethod !== "POST") return cors(405, { error: "Method not allowed" });

        const { code, price } = JSON.parse(event.body);
        if (!code || !price) return cors(400, { error: "code and price are required" });

        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { data: promo, error } = await db.from("promos").select("*").eq("code", code.toUpperCase()).single();

        if (error || !promo) return cors(400, { error: "Promo code not found" });
        if (!promo.active) return cors(400, { error: "Promo code is inactive" });
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            return cors(400, { error: "Promo code has expired" });
        }
        if (promo.max_uses && promo.used_count >= promo.max_uses) {
            return cors(400, { error: "Promo code usage limit exceeded" });
        }

        let discount;
        if (promo.discount_type === "percent") {
            discount = Math.round(price * promo.discount_value / 100);
        } else {
            discount = Math.min(promo.discount_value, price);
        }

        return cors(200, {
            valid: true,
            discount,
            finalPrice: price - discount,
            discountType: promo.discount_type,
            discountValue: promo.discount_value
        });
    } catch (err) {
        return cors(500, { error: err.message });
    }
};
