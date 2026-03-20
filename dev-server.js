// Simple dev server with in-memory API mock for testing
var http = require('http');
var fs = require('fs');
var path = require('path');

var orders = {};
var messages = {};

function parseBody(req) {
    return new Promise(function (resolve) {
        var body = '';
        req.on('data', function (chunk) { body += chunk; });
        req.on('end', function () {
            try { resolve(JSON.parse(body)); }
            catch (e) { resolve({}); }
        });
    });
}

function parseQuery(url) {
    var q = {};
    var idx = url.indexOf('?');
    if (idx === -1) return q;
    url.slice(idx + 1).split('&').forEach(function (p) {
        var kv = p.split('=');
        q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return q;
}

var server = http.createServer(async function (req, res) {
    var urlPath = req.url.split('?')[0];
    var query = parseQuery(req.url);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // API: Orders
    if (urlPath === '/api/orders') {
        if (req.method === 'POST') {
            var body = await parseBody(req);
            var order = {
                productId: body.productId,
                productName: body.productName,
                price: body.price,
                promoCode: body.promoCode || null,
                discount: body.discount || 0,
                accountType: body.accountType,
                accountData: body.accountData,
                telegramUserId: body.telegramUserId || null,
                telegramUsername: body.telegramUsername || null,
                id: String(Date.now()),
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            orders[order.id] = order;
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, id: order.id }));
            console.log('[ORDER] Created #' + order.id + ' — ' + order.productName);
            return;
        }
        if (req.method === 'GET') {
            var all = Object.values(orders);
            if (query.telegramUserId) {
                all = all.filter(function (o) { return o.telegramUserId === query.telegramUserId; });
            }
            all.sort(function (a, b) { return Number(b.id) - Number(a.id); });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(all));
            return;
        }
        if (req.method === 'PATCH') {
            var body = await parseBody(req);
            if (orders[body.id]) {
                orders[body.id].status = body.status;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, order: orders[body.id] }));
                console.log('[ORDER] #' + body.id + ' → ' + body.status);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Order not found' }));
            }
            return;
        }
    }

    // API: Messages
    if (urlPath === '/api/messages') {
        if (req.method === 'GET') {
            var orderId = query.orderId;
            var msgs = messages[orderId] || [];
            msgs.sort(function (a, b) { return Number(a.id) - Number(b.id); });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(msgs));
            return;
        }
        if (req.method === 'POST') {
            var body = await parseBody(req);
            var msg = {
                id: String(Date.now()) + String(Math.random()).slice(2, 5),
                orderId: body.orderId,
                sender: body.sender,
                text: body.text.trim(),
                createdAt: new Date().toISOString()
            };
            if (!messages[body.orderId]) messages[body.orderId] = [];
            messages[body.orderId].push(msg);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: msg }));
            console.log('[CHAT] ' + msg.sender + ' → order #' + body.orderId + ': ' + msg.text);
            return;
        }
    }

    // Static files
    var filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    var ext = path.extname(filePath).toLowerCase();
    var mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
    };

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(3001, function () {
    console.log('Dev server with API mock running on http://localhost:3001');
});
