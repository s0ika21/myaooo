// Direct Supabase REST API wrapper — no SDK needed
const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SUPABASE_KEY = () => process.env.SUPABASE_KEY;

function headers() {
    return {
        "apikey": SUPABASE_KEY(),
        "Authorization": "Bearer " + SUPABASE_KEY(),
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };
}

function restUrl(table) {
    return SUPABASE_URL() + "/rest/v1/" + table;
}

async function select(table, params = {}) {
    let url = restUrl(table) + "?select=*";
    if (params.eq) {
        for (const [col, val] of Object.entries(params.eq)) {
            url += "&" + col + "=eq." + encodeURIComponent(val);
        }
    }
    if (params.order) url += "&order=" + params.order;
    if (params.limit) url += "&limit=" + params.limit;
    const res = await fetch(url, { headers: headers() });
    return res.json();
}

async function selectOne(table, col, val) {
    const url = restUrl(table) + "?select=*&" + col + "=eq." + encodeURIComponent(val) + "&limit=1";
    const res = await fetch(url, { headers: headers() });
    const data = await res.json();
    return data[0] || null;
}

async function insert(table, row) {
    const res = await fetch(restUrl(table), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(row)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data[0];
}

async function update(table, eq, fields) {
    let url = restUrl(table) + "?";
    for (const [col, val] of Object.entries(eq)) {
        url += col + "=eq." + encodeURIComponent(val) + "&";
    }
    url += "select=*";
    const res = await fetch(url, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(fields)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data[0];
}

async function del(table, col, val) {
    const url = restUrl(table) + "?" + col + "=eq." + encodeURIComponent(val);
    const res = await fetch(url, { method: "DELETE", headers: headers() });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(JSON.stringify(data));
    }
}

module.exports = { select, selectOne, insert, update, del };
