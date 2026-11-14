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
import { createVercelHandler, originalApiRequest } from '../../api/parkly.ts';

test('Vercel rewrites preserve private PostgreSQL auth, queries, bookings and cookies', { timeout: 120000 }, async () => {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const runtime = await localCluster(await mkdtemp('/private/tmp/parkly-vercel-test-'), port);
  const db = new Database(runtime.settings.apiUrl, 4);
  const origin = 'https://parkly-vercel.example.test';
  try {
    await db.assertRestrictedRole();
    const fixtures = await seedFixtures(runtime.settings.ownerUrl, runtime.root);
    const adapted = netlifyHttp(createHttpHandler(db, { publicOrigin: origin }));
    const app = createVercelHandler((request, context) => adapted(request, context));
    async function request(path: string, method = 'GET', body?: unknown, cookie = '', sender = origin) {
      const source = new URL(origin + path);
      source.searchParams.set('__parkly_path', source.pathname);
      source.pathname = '/api/parkly';
      const response = await app.fetch(new Request(source, { method,
        headers: { Origin: sender, Cookie: cookie, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }));
      return { status: response.status, body: await response.json() as any,
        cookie: response.headers.get('set-cookie') || '' };
    }
    assert.equal(originalApiRequest(new Request(origin + '/api/parkly?__parkly_path=https://foreign.example/')), null);
    assert.equal((await app.fetch(new Request(origin + '/api/parkly'))).status, 404);
    assert.equal((await request('/api/v1/auth/signup', 'POST', {})).status, 403);
    const driver = fixtures.find(account => account.email === 'driver@test.local')!;
    const operator = fixtures.find(account => account.email === 'operator@test.local')!;
    const signed = await request('/api/v1/auth/login', 'POST', { email: driver.email, password: driver.password });
    assert.equal(signed.status, 200); assert.match(signed.cookie, /HttpOnly/); assert.match(signed.cookie, /Secure/);
    const cookie = signed.cookie.split(';')[0];
    const staff = await request('/api/v1/auth/login', 'POST', { email: operator.email, password: operator.password });
    const state = await request('/api/demo', 'GET', undefined, cookie);
    assert.equal(state.body.user.id, driver.id);
    const facility = state.body.lots.find((lot: any) => lot.code === 'p1');
    const start = Math.ceil((Date.now() + 3600000) / 3600000) * 3600000, end = start + 3600000;
    const available = await request(`/api/availability?id=${facility.id}&start=${start}&end=${end}`, 'GET', undefined, cookie);
    assert.equal(available.status, 200); assert.equal(available.body.physicalOccupancy, 'not_available');
    const held = await request('/api/v1/holds', 'POST', { spaceId: available.body.spaces.find((s: any) => s.available).id,
      start, end, quotedPrice: facility.price, idempotencyKey: randomUUID() }, cookie);
    assert.equal(held.status, 200);
    const confirmed = await request('/api/v1/holds/' + held.body.id + '/confirm', 'POST', {}, cookie);
    assert.equal(confirmed.status, 200); assert.ok(confirmed.body.reference);
    const managed = await request('/api/v1/reservations?scope=managed', 'GET', undefined, staff.cookie.split(';')[0]);
    assert.ok(managed.body.reservations.some((booking: any) => booking.id === confirmed.body.id));
    assert.equal((await request('/api/v1/auth/logout', 'POST', {}, cookie, 'https://foreign.example.test')).status, 403);
    assert.equal((await request('/api/v1/reservations/' + confirmed.body.id + '/cancel', 'POST', { idempotencyKey: randomUUID() }, cookie)).status, 200);
    assert.equal((await request('/api/v1/auth/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await request('/api/v1/auth/me', 'GET', undefined, cookie)).body.user, null);
  } finally { await db.close(); await runtime.cluster.stop(); }
});
