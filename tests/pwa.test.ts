import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('PWA manifest and branded assets exist with expected dimensions', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, '/#/map');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL('../public' + icon.src, import.meta.url));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
test('service worker bypasses APIs, auth, mutations, RSC and third-party tiles', async () => {
  const listeners: Record<string, (event: { request: { method: string; url: string; mode: string; headers: Headers }; respondWith(value: Promise<Response>): void }) => void> = {};
  let fetches = 0;
  const context = vm.createContext({ URL, Response,
    self: { location: { origin: 'https://parkly.test' }, addEventListener(name: string, fn: typeof listeners[string]) { listeners[name] = fn; } },
    fetch: async () => { fetches++; return new Response('online'); },
    caches: { match: async () => new Response('safe public fallback') },
  });
  vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  const dispatch = (path: string, method = 'GET', mode = 'cors', headers = new Headers()) => {
    let response: Promise<Response> | undefined;
    listeners.fetch({ request: { method, url: new URL(path, 'https://parkly.test').href, mode, headers }, respondWith(value) { response = value; } });
    return response;
  };
  for (const path of ['/api/demo', '/api/availability', '/signin-with-chatgpt', '/signout-with-chatgpt', '/callback', 'https://tile.openstreetmap.org/0/0/0.png']) {
    assert.equal(dispatch(path), undefined);
  }
  assert.equal(dispatch('/', 'POST'), undefined);
  assert.equal(dispatch('/', 'GET', 'cors', new Headers({ RSC: '1' })), undefined);
  assert.equal(dispatch('/private-booking.json'), undefined);
  assert.equal(await (await dispatch('/', 'GET', 'navigate'))!.text(), 'online');
  assert.equal(fetches, 1);
  context.fetch = async () => { throw Error('offline'); };
  assert.equal(await (await dispatch('/', 'GET', 'navigate'))!.text(), 'safe public fallback');
});
