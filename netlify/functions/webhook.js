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

        const { orderId, transactionStatus } = JSON.parse(event.body);
        if (!orderId) return cors(200, { received: true, error: "No orderId" });

        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { data: order, error } = await db.from("orders").select("*").eq("id", orderId).single();
        if (error || !order) return cors(200, { received: true, error: "Order not found" });

        if (transactionStatus === "Paid") {
            await db.from("orders").update({ status: "paid" }).eq("id", orderId);
            if (order.promo_code) {
                await db.from("promos")
                    .update({ used_count: (order.used_count || 0) + 1 })
                    .eq("code", order.promo_code);
            }
        }

        return cors(200, { received: true });
    } catch (err) {
        return cors(200, { received: true });
    }
};
