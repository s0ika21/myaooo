const { getStore } = require("@netlify/blobs");

function cors(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"
        },
        body: typeof body === "string" ? body : JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return cors(200, "");

    const store = getStore("promos");
    const indexStore = getStore("indexes");

    if (event.httpMethod === "GET") {
        let codes = [];
        try { codes = await indexStore.get("promos_all", { type: "json" }) || []; } catch {}
        const promos = [];
        for (const code of codes) {
            try {
                const p = await store.get(code, { type: "json" });
                if (p) promos.push(p);
            } catch {}
        }
        return cors(200, promos);
    }

    if (event.httpMethod === "POST") {
        const { code, discountType, discountValue, maxUses, expiresAt, active } = JSON.parse(event.body);
        if (!code || !discountType || !discountValue) {
            return cors(400, { error: "code, discountType, and discountValue are required" });
        }
        const promo = {
            code: code.toUpperCase(),
            discountType,
            discountValue,
            maxUses: maxUses || null,
            usedCount: 0,
            expiresAt: expiresAt || null,
            active: active !== undefined ? active : true,
            createdAt: new Date().toISOString()
        };
        await store.setJSON(promo.code, promo);
        let allCodes = [];
        try { allCodes = await indexStore.get("promos_all", { type: "json" }) || []; } catch {}
        if (!allCodes.includes(promo.code)) {
            allCodes.push(promo.code);
            await indexStore.setJSON("promos_all", allCodes);
        }
        return cors(201, { success: true, promo });
    }

    if (event.httpMethod === "DELETE") {
        const { code } = JSON.parse(event.body);
        if (!code) return cors(400, { error: "code is required" });
        const upperCode = code.toUpperCase();
        await store.delete(upperCode);
        let allCodes = [];
        try { allCodes = await indexStore.get("promos_all", { type: "json" }) || []; } catch {}
        const filtered = allCodes.filter(c => c !== upperCode);
        await indexStore.setJSON("promos_all", filtered);
        return cors(200, { success: true });
    }

    if (event.httpMethod === "PATCH") {
        const body = JSON.parse(event.body);
        const { code, ...fieldsToUpdate } = body;
        if (!code) return cors(400, { error: "code is required" });
        const upperCode = code.toUpperCase();
        let promo;
        try { promo = await store.get(upperCode, { type: "json" }); } catch {}
        if (!promo) return cors(404, { error: "Promo not found" });
        Object.assign(promo, fieldsToUpdate);
        promo.code = upperCode;
        await store.setJSON(upperCode, promo);
        return cors(200, { success: true, promo });
    }

    return cors(405, { error: "Method not allowed" });
};
