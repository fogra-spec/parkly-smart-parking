import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { availabilitySql, createBookingSql, updateInventorySql } from '../lib/server/booking-sql.ts';
import { validateBookingWindow, nextAstanaHour, businessPath, HOUR_MS } from '../lib/booking.ts';
import { authMode } from '../lib/server/config.ts';
import { actionSchema, validateMutationRequest } from '../lib/server/validation.ts';

function fixture() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  db.exec(`INSERT INTO users VALUES ('driver','Test driver','driver',1),('operator','Test operator','operator',1);
    INSERT INTO lots VALUES ('test','operator','Test parking','Astana','51.12','71.42','Covered',400,2,1);`);
  return db;
}
const start = Math.ceil((Date.now() + 2 * HOUR_MS) / HOUR_MS) * HOUR_MS;
function book(db: DatabaseSync, id: string, from: number, until: number, key: string | null = null, quote = 400) {
  return db.prepare(createBookingSql).run(id, 'driver', 'test', from, until, Date.now(), key, quote).changes;
}
const available = (db: DatabaseSync, from: number, until: number) =>
  (db.prepare(availabilitySql).get(from, until, 'test') as { available: number }).available;

test('SQL uses exact peak overlap, including back-to-back intervals', () => {
  const db = fixture();
  try {
    assert.equal(book(db, 'first', start, start + HOUR_MS), 1);
    assert.equal(book(db, 'second', start + HOUR_MS, start + 2 * HOUR_MS), 1);
    assert.equal(available(db, start, start + 2 * HOUR_MS), 1);
    assert.equal(book(db, 'long', start, start + 2 * HOUR_MS), 1);
    assert.equal(book(db, 'overflow', start, start + HOUR_MS), 0);
    assert.equal(available(db, start, start + 2 * HOUR_MS), 0);
    assert.equal(book(db, 'adjacent', start + 2 * HOUR_MS, start + 3 * HOUR_MS), 1);
    db.prepare("UPDATE bookings SET status='cancelled' WHERE id='long'").run();
    assert.equal(available(db, start, start + 2 * HOUR_MS), 1);
  } finally { db.close(); }
});
test('capacity floor counts active intervals that started before the check time', () => {
  const db = fixture();
  try {
    book(db, 'active', start, start + 2 * HOUR_MS);
    assert.equal(db.prepare(updateInventorySql).run(start + HOUR_MS, 0, 500, 'operator', 'test').changes, 0);
    assert.equal(db.prepare(updateInventorySql).run(start + HOUR_MS, 1, 500, 'operator', 'test').changes, 1);
    assert.equal(db.prepare(updateInventorySql).run(start + 3 * HOUR_MS, 0, 500, 'operator', 'test').changes, 1);
  } finally { db.close(); }
});
test('idempotency, current quote, approval, disabled identity, and price snapshot', () => {
  const db = fixture();
  try {
    assert.equal(book(db, 'a', start, start + HOUR_MS, 'same-key'), 1);
    assert.equal(book(db, 'b', start, start + HOUR_MS, 'same-key'), 0);
    assert.equal(book(db, 'bad-price', start, start + HOUR_MS, null, 300), 0);
    db.exec('UPDATE lots SET price=500');
    assert.deepEqual({ ...db.prepare("SELECT total,hourly_price FROM bookings WHERE id='a'").get() }, { total: 400, hourly_price: 400 });
    assert.throws(() => db.exec("UPDATE bookings SET total=1 WHERE id='a'"));
    db.exec('UPDATE lots SET approved=0');
    assert.equal(book(db, 'unapproved', start, start + HOUR_MS, null, 500), 0);
    db.exec('UPDATE lots SET approved=1; UPDATE users SET active=0 WHERE id=\'driver\'');
    assert.equal(book(db, 'disabled', start, start + HOUR_MS, null, 500), 0);
  } finally { db.close(); }
});
test('append-only migrations preserve pre-existing bookings and add guards', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(new URL('../drizzle/0000_high_gabe_jones.sql', import.meta.url), 'utf8'));
    db.exec(`INSERT INTO users VALUES ('driver','Test driver','driver',1),('operator','Test operator','operator',1);
      INSERT INTO lots VALUES ('test','operator','Test parking','Astana','51.12','71.42','Covered',400,2,1);
      INSERT INTO bookings VALUES ('legacy','driver','test',${start},${start + HOUR_MS},400,'confirmed',${Date.now()});`);
    db.exec(readFileSync(new URL('../drizzle/0001_booking_foundation.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../drizzle/0002_database_guards.sql', import.meta.url), 'utf8'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bookings').get()!.n, 1);
    assert.equal(db.prepare("SELECT hourly_price FROM bookings WHERE id='legacy'").get()!.hourly_price, null);
    assert.throws(() => db.exec('UPDATE lots SET capacity=-1'));
    assert.throws(() => db.exec("UPDATE users SET role='superuser'"));
    db.exec("UPDATE bookings SET status='cancelled' WHERE id='legacy'");
    assert.throws(() => db.exec("UPDATE bookings SET status='confirmed' WHERE id='legacy'"));
  } finally { db.close(); }
});
test('booking validation rejects fractional, past, oversized and misaligned intervals', () => {
  assert.doesNotThrow(() => validateBookingWindow(start, start + HOUR_MS));
  for (const [a, b] of [[start + 1, start + HOUR_MS], [start, start + 25 * HOUR_MS],
    [start, start], [0, HOUR_MS], [start + .5, start + HOUR_MS], [Infinity, Infinity]]) {
    assert.throws(() => validateBookingWindow(a, b));
  }
  assert.equal(nextAstanaHour(Date.UTC(2026, 9, 28, 12, 10)), '2026-10-28T18:00');
  assert.equal(businessPath('#/operator'), 'operator');
  assert.equal(businessPath('#/unknown'), 'home');
});
test('remote demo auth fails closed, and input contracts reject missing flags', () => {
  assert.equal(authMode('http://127.0.0.1:5173', {}), 'demo');
  for (const url of ['https://example.com', 'http://192.168.0.13:5173']) {
    assert.equal(authMode(url, {}), 'disabled');
    assert.equal(authMode(url, { PARKLY_AUTH_MODE: 'demo' }), 'disabled');
  }
  assert.equal(authMode('https://example.com', { PARKLY_AUTH_MODE: 'sites' }), 'sites');
  assert.equal(authMode('http://localhost', { PARKLY_AUTH_MODE: 'typo' }), 'disabled');
  assert.equal(actionSchema.safeParse({ action: 'approval', id: 'test' }).success, false);
  assert.equal(actionSchema.safeParse({ action: 'inventory', id: 'test', capacity: 1.2, price: 400 }).success, false);
  assert.equal(actionSchema.safeParse({ action: 'book', id: 'test', start, end: start + HOUR_MS, total: 1 }).success, false);
  assert.match(validateMutationRequest(new Request('https://app.test/api/demo', { headers: { Origin: 'https://evil.test' } }))!, /origin/);
  assert.match(validateMutationRequest(new Request('https://app.test/api/demo', { headers: { 'Content-Type': 'text/plain' } }))!, /application\/json/);
});
