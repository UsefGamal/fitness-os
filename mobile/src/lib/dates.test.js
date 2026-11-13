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

test('dates and numbers are written in the app\'s language, not the phone\'s (TEST-1)', async () => {
  const { dateTime, formatDate, formatNumber, LOCALE, longDate, monthLabel } = await import('./dates.js');
  assert.equal(LOCALE, 'en-GB');
  assert.equal(formatDate('2026-11-12'), 'Thu 12 Nov');
  assert.equal(longDate('2026-11-12'), '12 Nov 2026');
  assert.equal(monthLabel('2026-11'), 'November 2026');
  assert.equal(formatNumber(12345), '12,345');
  assert.match(dateTime(new Date(2026, 10, 12, 8, 14).getTime()), /^Thu 12 Nov,? 08:14$/);
  // Western digits whatever happens; an Arabic phone would give ١٢.
  for (const text of [formatDate('2026-11-12'), longDate('2026-11-12'), monthLabel('2026-11'), formatNumber(12345)]) assert.match(text, /^[\x20-\x7E]+$/);
  // The locale can be passed for the day the app has Arabic.
  assert.notEqual(formatDate('2026-11-12', 'ar-EG'), formatDate('2026-11-12'));
});

test('no screen formats a date or number with the phone\'s own locale', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const hits = [];
  for (const name of readdirSync(root, { recursive: true })) {
    const file = String(name);
    if (!/\.(js|jsx)$/.test(file) || /\.test\.js$/.test(file)) continue;
    const text = readFileSync(new URL(file, root), 'utf8');
    if (/toLocale\w*\(\s*(undefined\b|\))/.test(text) || /new Intl\.\w+\(\s*(undefined\b|\))/.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});
