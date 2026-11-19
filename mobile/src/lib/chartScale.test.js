import assert from 'node:assert/strict';
import test from 'node:test';

import { dateScale } from './chartScale.js';

test('dateScale places points by date, not by position', () => {
  const x = dateScale(['2026-11-01', '2026-11-02', '2026-11-11'], 0, 100);
  assert.equal(x('2026-11-01'), 0);
  assert.equal(x('2026-11-02'), 10);
  assert.equal(x('2026-11-11'), 100);
});

test('dateScale with one date, or all on the same day, centres', () => {
  assert.equal(dateScale(['2026-11-01'], 0, 100)('2026-11-01'), 50);
  assert.equal(dateScale(['2026-11-01', '2026-11-01'], 10, 30)('2026-11-01'), 20);
  assert.equal(dateScale([], 0, 100)('2026-11-01'), 50);
});
