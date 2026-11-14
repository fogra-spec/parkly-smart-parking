// Read-only HTTP smoke test. No cookies, credentials, writes or remote hosts.
import assert from 'node:assert/strict';
const base = process.env.PARKLY_TEST_URL;
if (!base) throw Error('Set PARKLY_TEST_URL to the isolated local preview.');
const url = new URL(base);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw Error('This check only supports a loopback HTTP preview.');
}
for (const [path, mime] of [
  ['/manifest.webmanifest', 'json'], ['/sw.js', 'javascript'],
  ['/offline.html', 'html'], ['/icons/icon-192.png', 'image/png'],
  ['/project/business-report.md', 'text/'],
]) {
  const response = await fetch(new URL(path, url), { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
  const bytes = await response.arrayBuffer();
  assert.equal(new URL(response.url).origin, url.origin, 'No cross-origin redirect allowed');
  assert.equal(response.status, 200, path);
  assert.ok(bytes.byteLength > 100, path + ' must not return an empty 200 response');
  assert.ok(response.headers.get('content-type')?.includes(mime), path + ': invalid MIME type');
  if (path === '/sw.js') assert.match(response.headers.get('cache-control'), /no-cache|no-store/);
  if (path === '/manifest.webmanifest') assert.equal(JSON.parse(new TextDecoder().decode(bytes)).short_name, 'Parkly');
  console.log('PASS', path, bytes.byteLength + ' bytes');
}
