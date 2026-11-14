import test from 'node:test';
import assert from 'node:assert/strict';
import { filterParking } from '../lib/parking.ts';
import { demoLots } from '../lib/demo.ts';

test('search trims and matches areas case-insensitively while excluding pending listings', () => {
  const lots = demoLots.map(l => ({ ...l, available: l.capacity }));
  const filters = { query: '  bAiTeReK  ', maxPrice: null, type: 'All', onlyAvailable: false };
  assert.deepEqual(filterParking(lots, filters).map(l => l.id), ['p2']);
  assert.equal(filterParking(lots, { ...filters, query: '' }).length, 5);
  assert.equal(filterParking(lots, { ...filters, query: 'unknown area' }).length, 0);
});
test('combined filters include the price boundary and any price has no hidden ceiling', () => {
  const lots = demoLots.map(l => ({ ...l, available: l.id === 'p1' ? 0 : l.capacity }));
  assert.deepEqual(filterParking(lots, { query: '', maxPrice: 400, type: 'Covered', onlyAvailable: false }).map(l => l.id), ['p1']);
  assert.equal(filterParking(lots, { query: '', maxPrice: 400, type: 'Covered', onlyAvailable: true }).length, 0);
  lots[0].price = 5000;
  assert.ok(filterParking(lots, { query: '', maxPrice: null, type: 'All', onlyAvailable: false }).some(l => l.id === 'p1'));
});
