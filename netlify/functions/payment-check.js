const db = require("./db");

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

        const { orderId } = JSON.parse(event.body);
        if (!orderId) return cors(400, { error: "orderId is required" });

        const order = await db.selectOne("orders", "id", orderId);
        if (!order) return cors(404, { error: "Order not found" });

        if (order.status === "paid") return cors(200, { status: "paid" });

        const WATA_API = process.env.WATA_API_URL;
        const WATA_TOKEN = process.env.WATA_API_TOKEN;

        if (!WATA_API || !WATA_TOKEN) return cors(200, { status: order.status });

        const response = await fetch(WATA_API + "/transactions?orderId=" + encodeURIComponent(orderId), {
            headers: { "Authorization": "Bearer " + WATA_TOKEN }
        });
        const data = await response.json();
        const items = data.items || data;

        if (Array.isArray(items) && items.length > 0) {
            const tx = items[0];
            if (tx.status === "Paid") {
                await db.update("orders", { id: orderId }, { status: "paid" });
                if (order.promo_code) {
                    const promo = await db.selectOne("promos", "code", order.promo_code);
                    if (promo) {
                        await db.update("promos", { code: order.promo_code }, { used_count: (promo.used_count || 0) + 1 });
                    }
                }
                return cors(200, { status: "paid" });
            } else if (tx.status === "Declined") {
                return cors(200, { status: "declined" });
            }
        }

        return cors(200, { status: "pending" });
    } catch (err) {
        return cors(200, { status: "pending" });
    }
};
