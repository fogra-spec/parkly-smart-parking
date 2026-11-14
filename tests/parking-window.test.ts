import test from 'node:test';
import assert from 'node:assert/strict';
import { astanaInputTime, editParkingWindow, parkingWindowError } from '../lib/parking-window.ts';
import { HOUR_MS } from '../lib/booking.ts';

test('moving arrival to another day keeps the chosen duration across midnight and year boundaries', () => {
  const moved = editParkingWindow({ arrival: '2026-12-30T10:00', departure: '2026-12-30T13:00' }, 'arrival', '2026-12-31T23:00');
  assert.deepEqual(moved, { arrival: '2026-12-31T23:00', departure: '2027-01-01T02:00' });
  assert.equal(astanaInputTime(moved.departure) - astanaInputTime(moved.arrival), 3 * HOUR_MS);
  assert.equal(parkingWindowError(moved, astanaInputTime('2026-12-30T09:00')), '');
});

test('departure can change independently, and moving arrival later keeps that new duration', () => {
  const extended = editParkingWindow({ arrival: '2026-11-20T12:00', departure: '2026-11-20T14:00' }, 'departure', '2026-11-20T17:00');
  assert.equal(extended.arrival, '2026-11-20T12:00');
  assert.deepEqual(editParkingWindow(extended, 'arrival', '2026-11-21T08:00'), { arrival: '2026-11-21T08:00', departure: '2026-11-21T13:00' });
});

test('clearing/re-entering a native datetime field does not throw or lose the departure draft', () => {
  const cleared = editParkingWindow({ arrival: '2026-11-20T12:00', departure: '2026-11-20T14:00' }, 'arrival', '');
  assert.equal(cleared.arrival, ''); assert.equal(cleared.departure, '2026-11-20T14:00');
  assert.match(parkingWindowError(cleared), /complete/);
  assert.deepEqual(editParkingWindow(cleared, 'arrival', '2026-11-22T09:00'), { arrival: '2026-11-22T09:00', departure: '2026-11-22T11:00' });
  for (const draft of ['2026-', '2026-11-20T', '2026-02-30T12:00', 'not a date']) assert.ok(Number.isNaN(astanaInputTime(draft)));
});

test('invalid/past/misaligned/oversized windows are rejected and correcting them recovers', () => {
  const now = astanaInputTime('2026-11-14T10:00');
  const valid = { arrival: '2026-11-15T12:00', departure: '2026-11-15T14:00' };
  for (const changed of [
    { arrival: '', departure: '' },
    { ...valid, arrival: '2026-11-13T12:00' },
    { ...valid, arrival: '2026-11-15T12:30' },
    { ...valid, departure: '2026-11-15T11:00' },
    { ...valid, departure: '2026-11-16T13:00' },
    { arrival: '2027-11-15T12:00', departure: '2027-11-15T14:00' },
  ]) assert.notEqual(parkingWindowError(changed, now), '');
  assert.equal(parkingWindowError(valid, now), '');
  assert.equal(parkingWindowError({ ...valid, departure: '2026-11-16T12:00' }, now), '');
});
