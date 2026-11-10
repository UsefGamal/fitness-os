import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstName, watchTiles, partOfDay, sparkPath, trendChange } from './home.js';

test('partOfDay splits the day', () => {
  assert.equal(partOfDay(5), 'morning');
  assert.equal(partOfDay(11), 'morning');
  assert.equal(partOfDay(12), 'afternoon');
  assert.equal(partOfDay(17), 'evening');
  assert.equal(partOfDay(2), 'evening');
});

test('firstName takes the first word, trimmed, or empty', () => {
  assert.equal(firstName({ name: '  Yusuf Gamal ' }), 'Yusuf');
  assert.equal(firstName({ name: '' }), '');
  assert.equal(firstName(null), '');
  assert.equal(firstName({ name: 42 }), '');
  assert.equal(firstName({ name: 'a'.repeat(40) }).length, 20);
});

const S = [
  { date: '2026-10-20', trend: 97 },
  { date: '2026-10-27', trend: 96.5 },
  { date: '2026-11-03', trend: 95.9 },
  { date: '2026-11-10', trend: 95.7 },
];

test('trendChange compares with the point at least 14 days back', () => {
  assert.deepEqual(trendChange(S), { kg: -0.8, days: 14 });
  assert.deepEqual(trendChange(S, 7), { kg: -0.2, days: 7 });
});

test('trendChange uses the first point when history is shorter', () => {
  assert.deepEqual(trendChange(S.slice(2)), { kg: -0.2, days: 7 });
  assert.equal(trendChange(S.slice(0, 1)), null);
  assert.equal(trendChange([]), null);
});

test('sparkPath fits the box and ends on the last point', () => {
  const p = sparkPath(S, { w: 100, h: 40, pad: 0 });
  assert.match(p.d, /^M0\.0,0\.0 L/);
  assert.deepEqual(p.end, [100, 40]);
  assert.equal(sparkPath(S.slice(0, 1)), null);
  // A flat line doesn't divide by zero.
  assert.ok(!sparkPath([{ trend: 90 }, { trend: 90 }]).d.includes('NaN'));
});

test('watchTiles shows only what the watch sent', () => {
  assert.deepEqual(watchTiles({ steps: 2550, kcal: 228, sleepMin: 425 }), [
    { key: 'steps', value: '2,550' }, { key: 'kcal', value: '228' }, { key: 'sleep', value: '7h 05m' },
  ]);
  assert.deepEqual(watchTiles({ kcal: 0 }).map((x) => x.key), ['kcal']);
  assert.deepEqual(watchTiles({ sleepMin: 0 }), []);
  assert.deepEqual(watchTiles(), []);
});
