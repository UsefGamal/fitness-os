import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { arrivalWindow, paceRange } from './pace.js';

const TODAY = '2026-11-19';
// Losing 0.1 kg a day (0.7 kg a week), with a salty day thrown in.
const logs = (n, step = 2, salty = true) => Array.from({ length: n }, (_, i) => ({
  log_date: addDays(TODAY, -(n - 1 - i) * step),
  weight_kg: 100 - i * step * 0.1 + (salty && i === n - 2 ? 1.5 : 0),
}));
const LOSE = { direction: 'lose', set_on: '2026-09-01' };

test('paceRange measures kg a week from the weigh-ins, salty day and all', () => {
  const p = paceRange(logs(14), LOSE, TODAY);
  assert.equal(p.ready, true);
  assert.equal(p.mid, 0.7);
  assert.ok(p.low <= p.mid && p.mid <= p.high);
  assert.equal(p.n, 14);
  assert.equal(p.status, 'steady');
});

test('paceRange waits for 8 weigh-ins over 14 days, and skips the first 2 weeks of a goal', () => {
  assert.deepEqual(paceRange(logs(5), LOSE, TODAY), { ready: false, need: 3, reason: 'logs' });
  assert.equal(paceRange(logs(10, 1), LOSE, TODAY).reason, 'logs'); // 10 logs but only 9 days
  assert.deepEqual(paceRange(logs(14), { direction: 'lose', set_on: addDays(TODAY, -10) }, TODAY), { ready: false, need: 0, reason: 'water' });
});

test('paceRange on a gain goal counts gaining as towards it', () => {
  const up = logs(14, 2, false).map((l, i) => ({ ...l, weight_kg: 70 + i * 0.1 }));
  const p = paceRange(up, { direction: 'gain', set_on: '2026-09-01' }, TODAY);
  assert.equal(p.mid, 0.4);
  assert.equal(p.status, 'steady');
});

test('arrivalWindow gives dates, or too early when the window is over 6 weeks', () => {
  assert.deepEqual(arrivalWindow(95, 77.5, { low: 0.8, high: 1 }, TODAY), { early: addDays(TODAY, 123), late: addDays(TODAY, 153) });
  assert.deepEqual(arrivalWindow(95, 77.5, { low: 0.3, high: 1 }, TODAY), { tooEarly: true });
  assert.equal(arrivalWindow(95, 77.5, { low: -0.1, high: 0.2 }, TODAY), null);
  assert.equal(arrivalWindow(77.5, 77.5, { low: 0.8, high: 1 }, TODAY), null);
});
