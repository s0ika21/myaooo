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

    const { orderId } = JSON.parse(event.body);
    if (!orderId) return cors(400, { error: "orderId is required" });

    const store = getStore("orders");
    let order;
    try { order = await store.get(orderId, { type: "json" }); } catch {}
    if (!order) return cors(404, { error: "Order not found" });

    if (order.status === "paid") return cors(200, { status: "paid" });

    const WATA_API = process.env.WATA_API_URL;
    const WATA_TOKEN = process.env.WATA_API_TOKEN;

    if (!WATA_API || !WATA_TOKEN) {
        return cors(200, { status: order.status });
    }

    try {
        const response = await fetch(WATA_API + "/transactions?orderId=" + encodeURIComponent(orderId), {
            headers: { "Authorization": "Bearer " + WATA_TOKEN }
        });
        const data = await response.json();
        const items = data.items || data;

        if (Array.isArray(items) && items.length > 0) {
            const tx = items[0];
            if (tx.status === "Paid") {
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
                return cors(200, { status: "paid" });
            } else if (tx.status === "Declined") {
                return cors(200, { status: "declined" });
            }
        }

        return cors(200, { status: "pending" });
    } catch {
        return cors(200, { status: order.status });
    }
};
