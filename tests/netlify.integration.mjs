import assert from 'node:assert/strict';

const target = new URL(process.env.PARKLY_NETLIFY_TEST_URL || 'http://127.0.0.1:5194');
if (target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
  (target.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(target.hostname))) {
  throw Error('Use an exact HTTPS deployment origin or a loopback preview.');
}
let passed = 0;
async function get(path, type) {
  const response = await fetch(new URL(path, target), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, path);
  if (type) assert.match(response.headers.get('content-type') || '', type, path);
  passed++;
  return response;
}
const html = await (await get('/', /text\/html/)).text();
assert.match(html, /<title>Parkly/);
assert.match(html, /id="root"/);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]);
assert.ok(assets.length >= 2, 'The HTML must reference built JavaScript and CSS.');
for (const asset of new Set(assets)) await get(asset, asset.endsWith('.css') ? /text\/css/ : /javascript/);
await get('/sw.js', /javascript/);
const manifest = await (await get('/manifest.webmanifest', /application\/manifest\+json/)).json();
assert.equal(manifest.name, 'Parkly — Find. Reserve. Park.');
const stateResponse = await get('/api/demo', /application\/json/);
assert.match(stateResponse.headers.get('cache-control') || '', /no-store/);
const state = await stateResponse.json();
assert.equal(state.auth?.mode, 'password', 'The deployment must use PostgreSQL authentication.');
assert.equal(state.user, null);
assert.ok(Array.isArray(state.lots));
await get('/api/v1/facilities', /application\/json/);
for (const path of ['/api/v1/reservations', '/api/v1/admin/system', '/api/v1/operator/organizations']) {
  const response = await fetch(new URL(path, target));
  assert.ok([401, 403].includes(response.status), path + ' must reject anonymous access.');
  passed++;
}
const rejected = await fetch(new URL('/api/v1/auth/logout', target), {
  method: 'POST', headers: { Origin: 'https://foreign.example.test', 'Content-Type': 'application/json' }, body: '{}',
});
assert.equal(rejected.status, 403, 'Foreign-origin writes must be rejected.');
assert.equal((await rejected.json()).error.code, 'INVALID_ORIGIN');
passed++;
for (const path of ['/.env', '/backend/.local/runtime.json', '/.git/config', '/netlify/functions/parkly-api.mts']) {
  const response = await fetch(new URL(path, target));
  assert.equal(response.status, 404, path + ' must not expose source or private data.');
  passed++;
}
console.log(`PASS: ${passed} Netlify checks; compiled assets, PWA, PostgreSQL API, authorization, CSRF and private source paths.`);
