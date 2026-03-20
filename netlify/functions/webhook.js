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

        const { orderId, transactionStatus } = JSON.parse(event.body);
        if (!orderId) return cors(200, { received: true, error: "No orderId" });

        const order = await db.selectOne("orders", "id", orderId);
        if (!order) return cors(200, { received: true, error: "Order not found" });

        if (transactionStatus === "Paid") {
            await db.update("orders", { id: orderId }, { status: "paid" });
            if (order.promo_code) {
                const promo = await db.selectOne("promos", "code", order.promo_code);
                if (promo) {
                    await db.update("promos", { code: order.promo_code }, { used_count: (promo.used_count || 0) + 1 });
                }
            }
        }

        return cors(200, { received: true });
    } catch (err) {
        return cors(200, { received: true });
    }
};
