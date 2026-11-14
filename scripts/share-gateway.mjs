// Temporary public preview of the production build; never proxy the dev server.
import { createServer, request } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const configuration = new URL('../.sites-runtime/public-share.json', import.meta.url);
const assets = new Set(['/']);
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await collect(new URL(`${entry.name}/`, directory), path);
    else if (!path.endsWith('.map') && !path.includes('manifest.json') && path !== '/_headers') assets.add(path);
  }
}
await collect(new URL('dist/client/', root));
const server = createServer(async (incoming, outgoing) => {
  const fail = (status, message) => {
    outgoing.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Parkly-Public-Gateway': '1' });
    outgoing.end(JSON.stringify({ error: message }));
  };
  try {
    const { origin } = JSON.parse(await readFile(configuration, 'utf8'));
    if (!origin) return fail(503, 'Public Parkly preview is being configured.');
    const publicUrl = new URL(origin);
    if (publicUrl.protocol !== 'https:' || publicUrl.origin !== origin) return fail(503, 'Invalid preview configuration.');
    if (incoming.headers.host !== publicUrl.host) return fail(421, 'Unknown preview host.');
    const url = new URL(incoming.url, origin);
    if (url.origin !== origin || url.pathname.includes('%') || url.pathname.includes('\\')) return fail(400, 'Invalid path.');
    const api = url.pathname === '/api/demo' || url.pathname === '/api/availability' || url.pathname.startsWith('/api/v1/');
    if (!api && !assets.has(url.pathname)) return fail(404, 'Not found.');
    const mutation = !['GET', 'HEAD'].includes(incoming.method);
    if (!api && mutation) return fail(405, 'Method not allowed.');
    // Verify the public origin BEFORE translating it for the loopback API.
    if (mutation && (incoming.headers.origin !== origin || incoming.headers['sec-fetch-site'] === 'cross-site')) return fail(403, 'Invalid request origin.');
    const headers = {};
    for (const name of ['accept', 'accept-language', 'accept-encoding', 'content-type', 'content-length', 'cookie', 'sec-fetch-site', 'if-none-match', 'x-parkly-push-token', 'x-parkly-push-device', 'rsc', 'next-router-state-tree', 'next-url']) {
      if (incoming.headers[name]) headers[name] = incoming.headers[name];
    }
    // The existing backend remains local-only. This gateway is the exact-origin
    // CSRF boundary for this one HTTPS preview, including secure session cookies.
    if (mutation) headers.origin = 'http://127.0.0.1:5173';
    const upstream = request({ hostname: '127.0.0.1', port: 5181, path: url.pathname + url.search, method: incoming.method, headers, timeout: 20000 }, response => {
      const responseHeaders = { ...response.headers, 'X-Parkly-Public-Gateway': '1', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' };
      delete responseHeaders['access-control-allow-origin'];
      if (responseHeaders['set-cookie']) responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map(cookie => /;\s*Secure(?:;|$)/i.test(cookie) ? cookie : `${cookie}; Secure`);
      if (api || url.pathname === '/') responseHeaders['cache-control'] = 'private, no-store';
      outgoing.writeHead(response.statusCode, responseHeaders);
      response.pipe(outgoing);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!outgoing.headersSent) fail(502, 'Parkly preview is temporarily unavailable.'); else outgoing.destroy(); });
    let size = 0;
    incoming.on('data', chunk => { size += chunk.length; if (size > 262144) { upstream.destroy(); if (!outgoing.headersSent) fail(413, 'Request body too large.'); } });
    incoming.on('aborted', () => upstream.destroy());
    incoming.pipe(upstream);
  } catch { if (!outgoing.headersSent) fail(503, 'Public preview is not configured.'); }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(5182, '127.0.0.1', () => console.log('Parkly public gateway: http://127.0.0.1:5182 → production build :5181. Exact HTTPS host required; source files and database ports are excluded.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
