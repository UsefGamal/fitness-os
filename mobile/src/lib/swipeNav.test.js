import assert from 'node:assert/strict';
import test from 'node:test';

import { dragLock, dragOffset, neighbourTab, swipeCommits, tabPaths } from './swipeNav.js';

test('a drag is read as sideways or up/down once it has moved enough', () => {
  assert.equal(dragLock(4, 3), null);
  assert.equal(dragLock(-14, 3), 'x');
  assert.equal(dragLock(14, -12), 'y'); // diagonal: the page scrolls
  assert.equal(dragLock(2, 20), 'y');
  assert.equal(dragLock(-30, 20), 'x');
});

test('the next tab is one over and stops at the ends', () => {
  assert.equal(neighbourTab('/', true), '/plan');
  assert.equal(neighbourTab('/plan', false), '/');
  assert.equal(neighbourTab('/', false), null);
  assert.equal(neighbourTab('/stats', true), null);
  assert.equal(neighbourTab('/meals', true), '/stats');
});

test('only the tabs swipe', () => {
  assert.equal(neighbourTab('/settings', true), null);
  assert.equal(neighbourTab('/history/3', false), null);
});

test('with Meals off the Library takes its place', () => {
  assert.deepEqual(tabPaths(false), ['/', '/plan', '/workout', '/library', '/stats']);
  assert.equal(neighbourTab('/workout', true, tabPaths(false)), '/library');
});

test('the page follows the finger, and resists where there is no tab', () => {
  assert.equal(dragOffset(-120, true), -120);
  assert.equal(dragOffset(-120, false), -30);
  assert.equal(dragOffset(33.33, true), 33.3);
});

test('letting go opens the tab after a third of the screen or a flick', () => {
  assert.equal(swipeCommits({ dx: -130, ms: 900, width: 390 }), true); // slow but far
  assert.equal(swipeCommits({ dx: -100, ms: 900, width: 390 }), false); // slow and short: settles back
  assert.equal(swipeCommits({ dx: 60, ms: 100, width: 390 }), true); // a flick
  assert.equal(swipeCommits({ dx: 30, ms: 40, width: 390 }), false); // too short to be meant
  assert.equal(swipeCommits({ dx: 0, ms: 0, width: 390 }), false);
});
