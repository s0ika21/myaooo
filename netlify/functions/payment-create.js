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

        const { orderId } = JSON.parse(event.body);
        if (!orderId) return cors(400, { error: "orderId is required" });

        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { data: order, error } = await db.from("orders").select("*").eq("id", orderId).single();
        if (error || !order) return cors(404, { error: "Order not found" });

        const WATA_API = process.env.WATA_API_URL;
        const WATA_TOKEN = process.env.WATA_API_TOKEN;
        const APP_URL = process.env.APP_URL;

        if (!WATA_API || !WATA_TOKEN) {
            return cors(500, { error: "Payment service not configured" });
        }

        const response = await fetch(WATA_API + "/links", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + WATA_TOKEN
            },
            body: JSON.stringify({
                amount: order.final_price,
                currency: "RUB",
                orderId: orderId,
                description: order.product_name,
                successRedirectUrl: APP_URL + "?payment=success&orderId=" + orderId,
                failRedirectUrl: APP_URL + "?payment=fail&orderId=" + orderId
            })
        });

        const wataData = await response.json();
        if (!response.ok) {
            return cors(502, { error: "Payment service error", details: wataData });
        }

        await db.from("orders").update({
            wata_link_id: wataData.id,
            wata_payment_url: wataData.url
        }).eq("id", orderId);

        return cors(200, {
            success: true,
            paymentUrl: wataData.url,
            wataLinkId: wataData.id
        });
    } catch (err) {
        return cors(502, { error: err.message });
    }
};
