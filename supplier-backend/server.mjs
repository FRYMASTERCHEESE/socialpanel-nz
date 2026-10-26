/**
 * SocialPanel NZ — isolated, read-only multi-supplier viewer.
 * No credentials are stored in GitHub, logs, URLs, or browser storage.
 * No supplier order, refill, cancel or payment endpoint exists here.
 * This is a preview tool and NOT customer-facing order fulfilment.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeSupplierList, normalizeSupplierBalance } from '../supabase/functions/smmfollows-preview/normalize.mjs';

// Fixed server-side endpoints only. SMMLite's path is provisional until authenticated docs confirm it.
const SUPPLIERS = Object.freeze({
  smmfollows: Object.freeze({name:'SMMFollows',endpoint:'https://smmfollows.com/api/v2',keyName:'SMMFOLLOWS_API_KEY'}),
  smmlite: Object.freeze({name:'SMMLite',endpoint:'https://smmlite.com/api/v2',keyName:'SMMLITE_API_KEY'}),
  daosmm: Object.freeze({name:'DaoSMM',endpoint:'https://daosmm.com/api/v2',keyName:'DAOSMM_API_KEY'}),
  likeo: Object.freeze({name:'Likeo',endpoint:'https://likeo.net/api/v2',keyName:'LIKEO_API_KEY'}),
  alhitaan: Object.freeze({name:'Alhitaan',endpoint:'https://alhitaan.com/api/v2',keyName:'ALHITAAN_API_KEY'}),
  smmasia: Object.freeze({name:'SMMASIA',endpoint:'https://smmasia.org/api/v2',keyName:'SMMASIA_API_KEY'}),
});
const MAX_BODY_BYTES = 1024;
// Some SMM panels return thousands of records; a 2MB cap rejects valid catalogues.
// Keep a strict upper bound for memory safety, but allow a full multi-thousand-row list.
const MAX_UPSTREAM_BYTES = 12_000_000;
const BODY_TIMEOUT_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;
const ACCESS_TOKEN_MIN_LENGTH = 24;
const files = new Map([
  ['/admin', ['admin.html', 'text/html; charset=utf-8']],
  ['/admin/app.js', ['admin.js', 'text/javascript; charset=utf-8']],
  ['/admin/search.mjs', ['search.mjs', 'text/javascript; charset=utf-8']],
  ['/admin/style.css', ['admin.css', 'text/css; charset=utf-8']],
]);

function secureHeaders(res, contentType = 'application/json; charset=utf-8') {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
}
function json(res, status, body) {
  secureHeaders(res);
  res.writeHead(status);
  res.end(JSON.stringify(body));
}
function sha256(value) { return createHash('sha256').update(value, 'utf8').digest(); }
function hasOwnerToken(request, configured) {
  const incoming = request.headers.authorization;
  if (typeof incoming !== 'string' || !incoming.startsWith('Bearer ')) return false;
  const provided = incoming.slice(7);
  if (provided.length < ACCESS_TOKEN_MIN_LENGTH || provided.length > 512 || /[\r\n]/.test(provided)) return false;
  return timingSafeEqual(sha256(provided), sha256(configured));
}
async function readLimitedBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
class SupplierPreviewError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
async function readSupplierJson(response, providerName) {
  // Expose only the upstream HTTP status, never its response body or credentials.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new SupplierPreviewError(
      'SUPPLIER_ACCESS_DENIED', `${providerName} refused the API request (HTTP ${response.status}). Check the supplier API key, permissions or supplier-side IP blocking.`);
    if (response.status === 429) throw new SupplierPreviewError(
      'SUPPLIER_RATE_LIMIT', `${providerName} is rate-limiting API requests. Try again later.`);
    throw new SupplierPreviewError('SUPPLIER_HTTP_ERROR',
      `${providerName} API returned HTTP ${Number(response.status) || 'error'}. Check with their support if it continues.`);
  }
  if (Number(response.headers.get('content-length') || 0) > MAX_UPSTREAM_BYTES) {
    throw new SupplierPreviewError('SUPPLIER_TOO_LARGE', `${providerName} catalogue exceeds the 12 MB safe response limit.`);
  }
  if (!response.body) throw new SupplierPreviewError('SUPPLIER_EMPTY', `${providerName} returned an empty response.`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPSTREAM_BYTES) throw new SupplierPreviewError(
        'SUPPLIER_TOO_LARGE', `${providerName} catalogue exceeds the 12 MB safe response limit.`);
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new SupplierPreviewError(
    'SUPPLIER_NOT_JSON', `${providerName} returned something other than JSON, possibly a login or security-check page.`); }
  if (result && !Array.isArray(result) && typeof result === 'object' && result.error) {
    throw new SupplierPreviewError('SUPPLIER_REJECTED',
      `${providerName} rejected the API request. Check your private supplier key and account API permissions.`);
  }
  return result;
}
function safeSupplierFailure(error, providerName) {
  if (error instanceof SupplierPreviewError) return {code:error.code,error:error.message};
  if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return {
    code:'SUPPLIER_TIMEOUT', error:`${providerName} did not respond within 15 seconds. Try again later.`
  };
  if (error instanceof TypeError) return {
    code:'SUPPLIER_NETWORK', error:`The Render server could not reach ${providerName}. Check supplier availability or API access.`
  };
  // Unrecognized payloads or parsing errors are never forwarded or logged verbatim.
  return {code:'SUPPLIER_FORMAT',error:`${providerName} responded, but its service or balance data could not be processed. Contact support if this continues.`};
}

export function createHandler({ env = process.env, supplierFetch = globalThis.fetch } = {}) {
  const recent = new Map();
  return async function handler(req, res) {
    // Deliberately no CORS support: the owner viewer is served on this same origin.
    const origin = req.headers.origin;
    if (origin && origin !== 'https://' + req.headers.host && origin !== 'http://localhost:' + (env.PORT || 10000) && origin !== 'http://127.0.0.1:' + (env.PORT || 10000)) {
      return json(res, 403, { error: 'Cross-origin request rejected' });
    }
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/healthz') {
      return json(res, 200, { status: 'ok', product: 'SocialPanel NZ supplier preview', readOnly: true, ordersEnabled: false });
    }
    if (req.method === 'GET' && path === '/') {
      secureHeaders(res);
      res.writeHead(302, { Location: '/admin' });
      return res.end();
    }
    if (req.method === 'GET' && path === '/robots.txt') {
      secureHeaders(res, 'text/plain; charset=utf-8');
      res.writeHead(200);
      return res.end('User-agent: *\nDisallow: /\n');
    }
    if (req.method === 'GET' && files.has(path)) {
      const [file, type] = files.get(path);
      try {
        const content = await readFile(new URL('./' + file, import.meta.url));
        secureHeaders(res, type);
        res.writeHead(200);
        return res.end(content);
      } catch { return json(res, 503, { error: 'Viewer assets unavailable' }); }
    }
    if (req.method !== 'POST' || path !== '/api/preview') return json(res, 404, { error: 'Not found' });
    const owner = String(env.SOCIALPANEL_OWNER_TOKEN || '').trim();
    if (owner.length < ACCESS_TOKEN_MIN_LENGTH || owner.length > 512) return json(res, 503, { error: 'Private environment setup incomplete — set the owner token in Render' });
    if (!hasOwnerToken(req, owner)) return json(res, 401, { error: 'Owner access token required' });
    // Short per-IP throttle limits both accidental rapid polling and automated guessing.
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (recent.size > 1000) recent.clear();
    const entry = recent.get(ip) || { from: now, count: 0 };
    if (now - entry.from > 60_000) { entry.from = now; entry.count = 0; }
    entry.count++;
    recent.set(ip, entry);
    if (entry.count > 15) return json(res, 429, { error: 'Too many requests; retry later' });
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return json(res, 415, { error: 'JSON required' });
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    let activeSupplierName = 'SMMFollows';
    try {
      req.setTimeout(BODY_TIMEOUT_MS, () => req.destroy());
      let payload;
      try { payload = JSON.parse(await readLimitedBody(req)); }
      catch (e) { return json(res, String(e.message).includes('too large') ? 413 : 400, { error: 'Invalid request body' }); }
      const action = payload && !Array.isArray(payload) && typeof payload === 'object' ? payload.action : null;
      if (action !== 'services' && action !== 'balance') return json(res, 400, { error: 'Only read-only services and balance checks are available' });
      const providerId = payload.provider === undefined ? 'smmfollows' : payload.provider;
      if (typeof providerId !== 'string' || !Object.hasOwn(SUPPLIERS, providerId)) return json(res, 400, { error: 'Unknown supplier' });
      const supplier = SUPPLIERS[providerId];
      activeSupplierName = supplier.name;
      const apiKey = String(env[supplier.keyName] || '').trim();
      if (!apiKey) return json(res, 503, { error: `${supplier.name} key not configured in private Render settings` });
      const upstream = await supplierFetch(supplier.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({ key: apiKey, action }).toString(),
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const data = await readSupplierJson(upstream, supplier.name);
      const safe = action === 'services' ? normalizeSupplierList(data, 5000) : normalizeSupplierBalance(data);
      return json(res, 200, { provider: supplier.name, readOnly: true, ...safe });
    } catch (error) {
      // Never reveal upstream bodies, stack traces, supplier keys or owner tokens.
      // These safe reason codes distinguish catalogue size, supplier denial and networking.
      return json(res, 502, safeSupplierFailure(error, activeSupplierName));
    }
  };
}

export function startServer({ env = process.env } = {}) {
  const port = Number(env.PORT || 10000);
  const server = createServer(createHandler({ env }));
  server.requestTimeout = 20_000;
  server.headersTimeout = 15_000;
  server.listen(port, '0.0.0.0', () => {
    console.log('SocialPanel NZ supplier preview listening on port ' + port + ' (read-only)');
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
