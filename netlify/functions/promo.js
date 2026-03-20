const { createClient } = require("@supabase/supabase-js");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") return cors(200, "");
        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

        if (event.httpMethod === "GET") {
            const { data, error } = await db.from("promos").select("*").order("created_at", { ascending: false });
            if (error) return cors(500, { error: error.message });
            return cors(200, data.map(toCamel));
        }

        if (event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            if (!body.code || !body.discountType || !body.discountValue) {
                return cors(400, { error: "code, discountType, and discountValue are required" });
            }
            const promo = {
                code: body.code.toUpperCase(),
                discount_type: body.discountType,
                discount_value: body.discountValue,
                max_uses: body.maxUses || null,
                used_count: 0,
                expires_at: body.expiresAt || null,
                active: body.active !== undefined ? body.active : true
            };
            const { data, error } = await db.from("promos").upsert(promo).select().single();
            if (error) return cors(500, { error: error.message });
            return cors(201, { success: true, promo: toCamel(data) });
        }

        if (event.httpMethod === "DELETE") {
            const { code } = JSON.parse(event.body);
            if (!code) return cors(400, { error: "code is required" });
            const { error } = await db.from("promos").delete().eq("code", code.toUpperCase());
            if (error) return cors(500, { error: error.message });
            return cors(200, { success: true });
        }

        if (event.httpMethod === "PATCH") {
            const body = JSON.parse(event.body);
            const { code, ...fields } = body;
            if (!code) return cors(400, { error: "code is required" });
            const update = {};
            if (fields.active !== undefined) update.active = fields.active;
            if (fields.discountType) update.discount_type = fields.discountType;
            if (fields.discountValue) update.discount_value = fields.discountValue;
            if (fields.maxUses !== undefined) update.max_uses = fields.maxUses;
            if (fields.expiresAt !== undefined) update.expires_at = fields.expiresAt;
            const { data, error } = await db.from("promos").update(update).eq("code", code.toUpperCase()).select().single();
            if (error) return cors(404, { error: "Promo not found" });
            return cors(200, { success: true, promo: toCamel(data) });
        }

        return cors(405, { error: "Method not allowed" });
    } catch (err) {
        return cors(500, { error: err.message });
    }
};

function toCamel(row) {
    return {
        code: row.code,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        maxUses: row.max_uses,
        usedCount: row.used_count,
        expiresAt: row.expires_at,
        active: row.active,
        createdAt: row.created_at
    };
}
