const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const VOLL_API_KEY = process.env.VOLL_API_KEY;
const VOLL_COOKIE = process.env.VOLL_COOKIE || '';
const TRIGGER_ID = '9c3b27b6-1c6b-4d5d-a012-42bc20654e03';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function proxyTrigger(req, res) {
  if (!VOLL_API_KEY) return json(res, 500, { error: 'VOLL_API_KEY nao configurada' });

  let raw = '';
  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    let p;
    try { p = JSON.parse(raw || '{}'); }
    catch { return json(res, 400, { error: 'Body JSON invalido' }); }

    if (!['WHATSAPP', 'VOICE'].includes(p.action)) return json(res, 400, { error: 'action invalida' });
    if (!p.whatsapp || !p.try || !p.to) return json(res, 400, { error: 'Campos obrigatorios: action, whatsapp, try, to' });

    const body = JSON.stringify({
      action: p.action,
      whatsapp: String(p.whatsapp),
      try: Number(p.try),
      to: String(p.to)
    });

    const options = {
      hostname: 'suporte.vollsc.com',
      port: 443,
      path: `/api/triggers/activate/${TRIGGER_ID}?voll-api-key=${encodeURIComponent(VOLL_API_KEY)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    if (VOLL_COOKIE) options.headers.Cookie = VOLL_COOKIE;

    const upstream = https.request(options, upstreamRes => {
      let responseBody = '';
      upstreamRes.on('data', c => responseBody += c);
      upstreamRes.on('end', () => {
        res.writeHead(upstreamRes.statusCode || 502, {
          'Content-Type': upstreamRes.headers['content-type'] || 'text/plain; charset=utf-8'
        });
        res.end(responseBody);
      });
    });

    upstream.on('error', err => json(res, 502, { error: 'Falha ao acionar Voll', detail: err.message }));
    upstream.write(body);
    upstream.end();
  });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/trigger') return proxyTrigger(req, res);
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  res.writeHead(404); res.end('Not found');
}).listen(PORT, () => console.log(`Demo Voll Entrega: http://localhost:${PORT}`));
