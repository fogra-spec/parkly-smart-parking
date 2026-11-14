import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { localCluster } from '../scripts/cluster.ts';
import { seedFixtures } from '../scripts/seed.ts';
import { Database } from '../src/db.ts';
import { createHttpHandler } from '../src/http-handler.ts';
import { netlifyHttp } from '../src/netlify-http.ts';

test('Netlify adapter retains authenticated PostgreSQL booking and legacy contracts', { timeout: 120000 }, async t => {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const runtime = await localCluster(await mkdtemp('/private/tmp/parkly-netlify-test-'), port);
  const db = new Database(runtime.settings.apiUrl, 4);
  try {
    await db.assertRestrictedRole();
    await seedFixtures(runtime.settings.ownerUrl, runtime.root);
    const origin = 'https://parkly-netlify.example.test';
    const handle = netlifyHttp(createHttpHandler(db, { publicOrigin: origin, allowRegistration: true }));
    async function request(path: string, method = 'GET', body?: unknown, cookie = '', sender = origin) {
      const response = await handle(new Request(origin + path, {
        method, headers: { Origin: sender, Cookie: cookie, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }), { ip: '192.0.2.19' });
      return { status: response.status, body: await response.json() as any, cookie: response.headers.get('set-cookie') || '', cache: response.headers.get('cache-control') };
    }
    const password = 'Synthetic-Netlify-test-password-42!';
    const one = await request('/api/v1/auth/signup', 'POST', { name: 'Cloud One', email: 'cloud-one@example.test', password });
    const two = await request('/api/v1/auth/signup', 'POST', { name: 'Cloud Two', email: 'cloud-two@example.test', password });
    assert.equal(one.status, 201); assert.equal(two.status, 201);
    const cookie = one.cookie.split(';')[0], other = two.cookie.split(';')[0];
    await t.test('secure same-origin cookies, original user identity and origin rejection', async () => {
      assert.match(one.cookie, /HttpOnly/); assert.match(one.cookie, /Secure/); assert.match(one.cookie, /SameSite=Strict/);
      assert.equal((await request('/api/v1/auth/me', 'GET', undefined, cookie)).body.user.id, one.body.userId);
      assert.equal((await request('/api/v1/auth/logout', 'POST', {}, cookie, 'https://foreign.example.test')).status, 403);
      assert.equal((await request('/api/v1/reservations', 'GET')).status, 401);
      assert.equal((await request('/api/v1/auth/me', 'GET', undefined, cookie)).cache, 'private, no-store');
    });
    const state = await request('/api/demo', 'GET', undefined, cookie);
    const facility = state.body.lots.find((lot: any) => lot.code === 'p1');
    const start = Math.ceil((Date.now() + 3600000) / 3600000) * 3600000, end = start + 3600000;
    const path = `/api/availability?id=${facility.id}&start=${start}&end=${end}`;
    const availability = await request(path, 'GET', undefined, cookie);
    assert.equal(availability.status, 200);
    assert.equal(availability.body.physicalOccupancy, 'not_available');
    assert.equal(availability.body.available, availability.body.spaces.filter((space: any) => space.available).length);
    const spaceId = availability.body.spaces.find((space: any) => space.available).id;
    let bookingId = '';
    await t.test('racing requests create one hold and booking; replay is idempotent', async () => {
      const payload = { spaceId, start, end, quotedPrice: facility.price, idempotencyKey: randomUUID() };
      const results = await Promise.all([
        request('/api/v1/holds', 'POST', payload, cookie),
        request('/api/v1/holds', 'POST', { ...payload, idempotencyKey: randomUUID() }, other),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      const winner = results.findIndex(result => result.status === 200);
      const winningCookie = winner === 0 ? cookie : other;
      const losingCookie = winner === 0 ? other : cookie;
      const confirmed = await request(`/api/v1/holds/${results[winner].body.id}/confirm`, 'POST', {}, winningCookie);
      assert.equal(confirmed.status, 200); bookingId = confirmed.body.id;
      assert.equal((await request(`/api/v1/holds/${results[winner].body.id}/confirm`, 'POST', {}, winningCookie)).body.id, bookingId);
      assert.equal((await request('/api/v1/reservations/' + bookingId, 'GET', undefined, losingCookie)).status, 404);
      const key = randomUUID();
      const cancel = () => request(`/api/v1/reservations/${bookingId}/cancel`, 'POST', { idempotencyKey: key }, winningCookie);
      assert.equal((await cancel()).status, 200); assert.equal((await cancel()).status, 200);
      const stored = await request('/api/v1/reservations/' + bookingId, 'GET', undefined, winningCookie);
      assert.equal(stored.body.reservation.status, 'cancelled');
      assert.deepEqual(stored.body.history.map((entry: any) => entry.to_status), ['confirmed', 'cancelled']);
    });
    await t.test('compatibility writes retain origin checks and input validation', async () => {
      assert.equal((await request('/api/demo', 'POST', { action: 'logout' }, cookie, 'https://foreign.example.test')).status, 403);
      assert.equal((await request('/api/availability?id=bad&start=0&end=0')).status, 400);
      assert.equal((await request('/.env')).status, 404);
      assert.equal((await request('/api/demo', 'POST', { action: 'logout' }, cookie)).status, 200);
      assert.equal((await request('/api/v1/auth/me', 'GET', undefined, cookie)).body.user, null);
    });
  } finally { await db.close(); await runtime.cluster.stop(); }
});
