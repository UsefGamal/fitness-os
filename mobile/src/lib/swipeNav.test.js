import assert from 'node:assert/strict';
import test from 'node:test';

import { swipeTarget, tabPaths } from './swipeNav.js';

const g = (dx, extra = {}) => ({ dx, dy: 0, ms: 200, startX: 200, width: 390, ...extra });

test('a swipe moves one tab over and stops at the ends', () => {
  assert.deepEqual(swipeTarget('/', g(-120)), { to: '/plan', forward: true });
  assert.deepEqual(swipeTarget('/plan', g(120)), { to: '/', forward: false });
  assert.equal(swipeTarget('/', g(120)), null);
  assert.equal(swipeTarget('/stats', g(-120)), null);
  assert.deepEqual(swipeTarget('/meals', g(-120)), { to: '/stats', forward: true });
});

test('short, slow, diagonal and edge swipes do nothing', () => {
  assert.equal(swipeTarget('/plan', g(-50)), null);
  assert.equal(swipeTarget('/plan', g(-120, { dy: 80 })), null);
  assert.equal(swipeTarget('/plan', g(-120, { ms: 900 })), null);
  assert.equal(swipeTarget('/plan', g(120, { startX: 10 })), null);
  assert.equal(swipeTarget('/plan', g(-120, { startX: 380 })), null);
});

test('only the tabs swipe, and Arabic turns the other way', () => {
  assert.equal(swipeTarget('/settings', g(-120)), null);
  assert.equal(swipeTarget('/history/3', g(-120)), null);
  assert.deepEqual(swipeTarget('/', g(120), { rtl: true }), { to: '/plan', forward: true });
  assert.equal(swipeTarget('/', g(-120), { rtl: true }), null);
});

test('with Meals off the Library takes its place', () => {
  assert.deepEqual(tabPaths(false), ['/', '/plan', '/workout', '/library', '/stats']);
  assert.deepEqual(swipeTarget('/workout', g(-120), { tabs: tabPaths(false) }), { to: '/library', forward: true });
});
