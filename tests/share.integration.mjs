// Read-only public-preview checks, with an optional synthetic test login/logout.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { origin } = JSON.parse(await readFile(new URL('../.sites-runtime/public-share.json', import.meta.url), 'utf8'));
assert.match(origin, /^https:\/\//);
let checks = 0;
async function get(path) { return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(20000) }); }
for (const path of ['/', '/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/api/v1/facilities', '/api/demo']) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  checks++;
}
for (const path of ['/.env', '/backend/.local/runtime.json', '/@fs/etc/passwd', '/scripts/share-gateway.mjs', '/.git/config']) {
  assert.equal((await get(path)).status, 404, path); checks++;
}
for (const attacker of [undefined, 'https://example.invalid']) {
  const response = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(attacker ? { Origin: attacker } : {}) }, body: '{}', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 403); checks++;
}
const privateResponse = await get('/api/v1/reservations');
assert.equal(privateResponse.status, 401); checks++;
// The gateway must translate only an already validated public Origin. A malformed
// login from that origin reaches server validation rather than bypassing it.
const validation = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}', signal: AbortSignal.timeout(20000) });
assert.equal(validation.status, 400); checks++;
if (process.env.PARKLY_SHARE_TEST_LOGIN === '1') {
  const account = JSON.parse(await readFile(new URL('../backend/.local/browser-account.json', import.meta.url), 'utf8'));
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  const login = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(20000) });
  assert.equal(login.status, 200, 'Synthetic test account login');
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie?.includes('; Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'), 'Secure session cookie');
  const session = cookie.split(';')[0];
  try {
    const own = await fetch(`${origin}/api/v1/reservations`, { headers: { Cookie: session }, signal: AbortSignal.timeout(20000) });
    assert.equal(own.status, 200, 'Authenticated booking history');
  } finally {
    const logout = await fetch(`${origin}/api/v1/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: session }, body: '{}', signal: AbortSignal.timeout(20000) });
    assert.equal(logout.status, 200, 'Logout');
  }
  checks += 4;
}
console.log(`PASS: ${checks} public preview checks; app, API, PWA, private routes, blocked source paths and CSRF.`);
