const { getStore } = require("@netlify/blobs");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: typeof body === "string" ? body : JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return cors(200, "");

    const store = getStore("orders");
    const indexStore = getStore("indexes");

    if (event.httpMethod === "POST") {
        const body = JSON.parse(event.body);
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const order = {
            id,
            productName: body.productName,
            price: body.price,
            finalPrice: body.finalPrice || body.price,
            promoCode: body.promoCode || null,
            discount: body.discount || 0,
            accountType: body.accountType,
            accountData: body.accountData,
            telegramUserId: body.telegramUserId || null,
            telegramUsername: body.telegramUsername || null,
            status: "awaiting_payment",
            wataLinkId: null,
            wataPaymentUrl: null,
            createdAt: new Date().toISOString()
        };
        await store.setJSON(id, order);

        let allOrders = [];
        try { allOrders = await indexStore.get("orders_all", { type: "json" }) || []; } catch {}
        allOrders.unshift(id);
        await indexStore.setJSON("orders_all", allOrders);

        if (order.telegramUserId) {
            let userOrders = [];
            try { userOrders = await indexStore.get("user:" + order.telegramUserId, { type: "json" }) || []; } catch {}
            userOrders.unshift(id);
            await indexStore.setJSON("user:" + order.telegramUserId, userOrders);
        }
        return cors(201, { success: true, order });
    }

    if (event.httpMethod === "GET") {
        const params = event.queryStringParameters || {};
        let ids = [];
        try {
            if (params.telegramUserId) {
                ids = await indexStore.get("user:" + params.telegramUserId, { type: "json" }) || [];
            } else {
                ids = await indexStore.get("orders_all", { type: "json" }) || [];
            }
        } catch {}

        let orders = [];
        for (const id of ids) {
            try {
                const o = await store.get(id, { type: "json" });
                if (o) orders.push(o);
            } catch {}
        }
        if (params.status) orders = orders.filter(o => o.status === params.status);
        return cors(200, orders);
    }

    if (event.httpMethod === "PATCH") {
        const body = JSON.parse(event.body);
        const { id, status } = body;
        let order;
        try { order = await store.get(id, { type: "json" }); } catch {}
        if (!order) return cors(404, { error: "Not found" });
        order.status = status;
        await store.setJSON(id, order);
        return cors(200, { success: true, order });
    }

    return cors(405, { error: "Method not allowed" });
};
