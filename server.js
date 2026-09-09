const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const VOLL_API_KEY = process.env.VOLL_API_KEY;
const VOLL_COOKIE = process.env.VOLL_COOKIE || '';
const TRIGGER_HOST = 'produtos.vollsc.com';
const TRIGGER_ID = 'a62dbdfa-baed-46f9-94f0-790bae885e1a';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#171052"/><stop offset="1" stop-color="#74115f"/></linearGradient>
    <linearGradient id="g2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a90074"/><stop offset="1" stop-color="#ff0055"/></linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#fff"/>
  <path d="M17 15c-3-2-7 0-7 4 0 2 1 3 2 4l15 12 10-10-20-10z" fill="url(#g1)"/>
  <path d="M28 24c2-2 5-2 7 0l13 9c3 2 3 6 0 8L23 56c-3 2-7 0-7-4 0-2 1-3 2-4l19-14-9-10z" fill="url(#g2)"/>
</svg>`;

const BRAND_HTML = `<div class="delivery-brand" aria-label="Voll Delivery">
  <div class="delivery-lockup">
    <svg class="delivery-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="brandG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#171052"/><stop offset="1" stop-color="#74115f"/></linearGradient>
        <linearGradient id="brandG2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a90074"/><stop offset="1" stop-color="#ff0055"/></linearGradient>
      </defs>
      <path d="M17 15c-3-2-7 0-7 4 0 2 1 3 2 4l15 12 10-10-20-10z" fill="url(#brandG1)"/>
      <path d="M28 24c2-2 5-2 7 0l13 9c3 2 3 6 0 8L23 56c-3 2-7 0-7-4 0-2 1-3 2-4l19-14-9-10z" fill="url(#brandG2)"/>
    </svg>
    <div class="delivery-wordmark"><span class="voll-word">Voll</span><span class="delivery-word">Delivery</span></div>
  </div>
  <div class="powered-by">POWERED BY VOLL SOLUTIONS</div>
</div>`;

const BRAND_CSS = `<style id="voll-delivery-branding">
  :root{--primary:#ef0057!important;--blue:#171052!important}
  body{background:#fff7fb!important}
  header{background:#fff8fc!important;border-bottom-color:#f2dfe8!important;height:82px!important}
  .delivery-brand{display:flex;align-items:center;gap:18px}
  .delivery-lockup{display:flex;align-items:center;gap:9px;background:#fff;padding:8px 14px;border-radius:14px;box-shadow:0 6px 18px rgba(239,0,87,.08)}
  .delivery-icon{width:34px;height:34px;display:block}
  .delivery-wordmark{font-size:23px;line-height:1;font-weight:800;letter-spacing:-.7px;display:flex;gap:5px;align-items:center}
  .voll-word{color:#ef0057}
  .delivery-word{color:#171052}
  .powered-by{font-size:10px;letter-spacing:2px;color:#6676a0;font-weight:800;white-space:nowrap}
  .badge{background:#fff0f6!important;color:#b50046!important}
  .logsbtn{background:#171052!important}
  .order-number{color:#ef0057!important}
  button.primary{background:#ef0057!important}
  .avatar{background:#fff0f6!important;color:#ef0057!important}
  @media(max-width:760px){.powered-by{display:none}.delivery-wordmark{font-size:20px}.delivery-lockup{padding:7px 10px}.delivery-icon{width:30px;height:30px}}
</style>`;

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
      hostname: TRIGGER_HOST,
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

function renderDemo() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Voll Delivery - Demo</title>');
  html = html.replace('</head>', `<link rel="icon" type="image/svg+xml" href="/favicon.svg">${BRAND_CSS}</head>`);
  html = html.replace(
    /<div class="brand"><div class="brandmark">V<\/div><div class="brandtext"><b>Voll<\/b><span>[^<]*<\/span><\/div><\/div>/,
    BRAND_HTML
  );
  return html;
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/trigger') return proxyTrigger(req, res);
  if (req.method === 'GET' && req.url === '/favicon.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(FAVICON_SVG);
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderDemo());
  }
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  res.writeHead(404); res.end('Not found');
}).listen(PORT, () => console.log(`Voll Delivery Demo: http://localhost:${PORT}`));
