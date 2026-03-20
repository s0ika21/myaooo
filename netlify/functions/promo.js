const db = require("./db");

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

        if (event.httpMethod === "GET") {
            const data = await db.select("promos", { order: "created_at.desc" });
            return cors(200, data.map(toCamel));
        }

        if (event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            if (!body.code || !body.discountType || !body.discountValue) {
                return cors(400, { error: "code, discountType, and discountValue are required" });
            }
            const data = await db.insert("promos", {
                code: body.code.toUpperCase(),
                discount_type: body.discountType,
                discount_value: body.discountValue,
                max_uses: body.maxUses || null,
                used_count: 0,
                expires_at: body.expiresAt || null,
                active: body.active !== undefined ? body.active : true
            });
            return cors(201, { success: true, promo: toCamel(data) });
        }

        if (event.httpMethod === "DELETE") {
            const { code } = JSON.parse(event.body);
            if (!code) return cors(400, { error: "code is required" });
            await db.del("promos", "code", code.toUpperCase());
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
            const data = await db.update("promos", { code: code.toUpperCase() }, update);
            return cors(200, { success: true, promo: toCamel(data) });
        }

        return cors(405, { error: "Method not allowed" });
    } catch (err) {
        return cors(500, { error: err.message });
    }
};

function toCamel(row) {
    if (!row) return null;
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
