const db = require("./db");

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

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") return cors(200, "");

        if (event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const row = {
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
            const data = await db.insert("orders", row);
            return cors(201, { success: true, order: toCamel(data) });
        }

        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            const eq = {};
            if (params.telegramUserId) eq.telegram_user_id = params.telegramUserId;
            if (params.status) eq.status = params.status;
            const data = await db.select("orders", { eq, order: "created_at.desc" });
            return cors(200, data.map(toCamel));
        }

        if (event.httpMethod === "PATCH") {
            const body = JSON.parse(event.body);
            const data = await db.update("orders", { id: body.id }, { status: body.status });
            return cors(200, { success: true, order: toCamel(data) });
        }

        return cors(405, { error: "Method not allowed" });
    } catch (err) {
        return cors(500, { error: err.message });
    }
};

function toCamel(row) {
    if (!row) return null;
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
