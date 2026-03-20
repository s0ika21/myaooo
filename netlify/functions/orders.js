const { createClient } = require("@supabase/supabase-js");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

function getDb() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") return cors(200, "");

        // Debug: check env vars
        if (event.queryStringParameters && event.queryStringParameters.debug === "1") {
            return cors(200, {
                hasUrl: !!process.env.SUPABASE_URL,
                urlPrefix: (process.env.SUPABASE_URL || "").substring(0, 20),
                hasKey: !!process.env.SUPABASE_KEY,
                keyPrefix: (process.env.SUPABASE_KEY || "").substring(0, 20)
            });
        }

        const db = getDb();

        if (event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const order = {
                id,
                product_name: body.productName,
                price: body.price,
                final_price: body.finalPrice || body.price,
                promo_code: body.promoCode || null,
                discount: body.discount || 0,
                account_type: body.accountType,
                account_data: body.accountData,
                telegram_user_id: body.telegramUserId || null,
                telegram_username: body.telegramUsername || null,
                status: "awaiting_payment"
            };
            const { data, error } = await db.from("orders").insert(order).select().single();
            if (error) return cors(500, { error: error.message });

            // Return camelCase for frontend
            return cors(201, { success: true, order: toCamel(data) });
        }

        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            let query = db.from("orders").select("*").order("created_at", { ascending: false });
            if (params.telegramUserId) query = query.eq("telegram_user_id", params.telegramUserId);
            if (params.status) query = query.eq("status", params.status);
            const { data, error } = await query;
            if (error) return cors(500, { error: error.message });
            return cors(200, data.map(toCamel));
        }

        if (event.httpMethod === "PATCH") {
            const body = JSON.parse(event.body);
            const { id, status } = body;
            const { data, error } = await db.from("orders").update({ status }).eq("id", id).select().single();
            if (error) return cors(404, { error: "Not found" });
            return cors(200, { success: true, order: toCamel(data) });
        }

        return cors(405, { error: "Method not allowed" });
    } catch (err) {
        return cors(500, { error: err.message });
    }
};

function toCamel(row) {
    return {
        id: row.id,
        productName: row.product_name,
        price: row.price,
        finalPrice: row.final_price,
        promoCode: row.promo_code,
        discount: row.discount,
        accountType: row.account_type,
        accountData: row.account_data,
        telegramUserId: row.telegram_user_id,
        telegramUsername: row.telegram_username,
        status: row.status,
        wataLinkId: row.wata_link_id,
        wataPaymentUrl: row.wata_payment_url,
        createdAt: row.created_at
    };
}
