import assert from 'node:assert/strict';
import test from 'node:test';

import { msUntilMidnight, todayISO } from './dates.js';

test('the next local midnight is just over the time left in the day', () => {
  assert.equal(msUntilMidnight(new Date(2026, 10, 12, 23, 59, 0)), 61000);
  assert.equal(msUntilMidnight(new Date(2026, 10, 12, 0, 0, 0)), 24 * 3600000 + 1000);
});

test('at least a second, so a timer never spins', () => {
  assert.ok(msUntilMidnight(new Date(2026, 10, 12, 23, 59, 59, 999)) >= 1000);
});

test('after the wait the date has moved on', () => {
  const now = new Date(2026, 11, 31, 22, 30);
  assert.equal(todayISO(new Date(now.getTime() + msUntilMidnight(now))), '2027-01-01');
});
