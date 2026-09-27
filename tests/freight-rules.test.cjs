const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../site/freight-rules.js');
const search = { origin: 'Guangzhou, China', destination: 'Dubai, UAE', ready: '2026-10-01', weight: 1000, cbm: 5, mode: 'compare', cargoType: 'cartons', flex: false };
test('route and cargo validation rejects unsafe or impossible values', () => {
  assert.equal(rules.validateSearch(search, '2026-09-27'), '');
  for (const change of [{ destination: search.origin }, { ready: '2026-09-26' }, { ready: '2026-02-30' }, { weight: NaN }, { weight: Infinity }, { cbm: 0 }, { mode: 'space' }]) assert.ok(rules.validateSearch({ ...search, ...change }, '2026-09-27'));
});
test('full containers cannot produce air or LCL offers', () => {
  const container = { ...search, mode: 'sea', cargoType: 'container', containerSize: '40HC', containers: 2, cbm: '' };
  assert.equal(rules.validateSearch(container, '2026-09-27'), '');
  assert.ok(rules.validateSearch({ ...container, mode: 'air' }, '2026-09-27'));
  assert.ok(rules.validateSearch({ ...container, containers: 1.5 }, '2026-09-27'));
  assert.deepEqual(rules.options(container).map(o => o.id), ['sea-fcl']);
});
test('unconfirmed routes never acquire invented prices or transit promises', () => {
  for (const mode of ['compare', 'sea', 'air', 'road']) {
    for (const offer of rules.options({ ...search, mode })) {
      assert.equal(offer.status, 'REQUEST_ONLY');
      assert.equal(offer.price, undefined);
      assert.equal(offer.transitDays, undefined);
    }
  }
});
test('landed cost uses gross margin with decimals and rejects invalid inputs', () => {
  assert.deepEqual(rules.margin(50, 100, 1000, 25), { landed: 60, selling: 80 });
  assert.equal(rules.margin(40, 1000, 5000, 30).selling.toFixed(2), '64.29');
  for (const args of [[40, 0, 5000, 30], [40, 1.5, 5000, 30], [40, 1000, -1, 30], [40, 1000, 5000, 100], [40, 1000, 5000, -1], ['', 1000, 5000, 30]]) assert.throws(() => rules.margin(...args));
});
test('special cargo and door delivery surface review requirements', () => {
  assert.equal(rules.reviewFlags({ batteries: true, dangerous: true, oversized: true, stackable: false, scope: 'door' }).length, 5);
  assert.equal(rules.reviewFlags({ stackable: true, scope: 'terminal' }).length, 0);
});
