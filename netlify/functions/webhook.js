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

    const { orderId, transactionStatus } = JSON.parse(event.body);

    if (!orderId) return cors(200, { received: true, error: "No orderId" });

    const store = getStore("orders");
    let order;
    try { order = await store.get(orderId, { type: "json" }); } catch {}
    if (!order) return cors(200, { received: true, error: "Order not found" });

    if (transactionStatus === "Paid") {
        order.status = "paid";
        await store.setJSON(orderId, order);

        if (order.promoCode) {
            const promoStore = getStore("promos");
            try {
                const promo = await promoStore.get(order.promoCode.toUpperCase(), { type: "json" });
                if (promo) {
                    promo.usedCount = (promo.usedCount || 0) + 1;
                    await promoStore.setJSON(order.promoCode.toUpperCase(), promo);
                }
            } catch {}
        }
    }

    return cors(200, { received: true });
};
