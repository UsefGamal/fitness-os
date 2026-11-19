import assert from 'node:assert/strict';
import test from 'node:test';

import { TOUR, finishTour, placeTip, replayTour, tourDue, tourStops } from './tour.js';

const fresh = { setup: { done_on: '2026-11-19' }, settings: {} };

test('plays once after setup, never mid-workout, never on a phone without setup', () => {
  assert.equal(tourDue(fresh), true);
  assert.equal(tourDue(fresh, { workoutActive: true }), false);
  assert.equal(tourDue({ settings: {} }), false, 'Yusuf-style phone: no setup, no tour');
  assert.equal(tourDue(null), false);
  const seen = finishTour(fresh, '2026-11-19');
  assert.equal(tourDue(seen), false);
  assert.equal(finishTour(fresh, '2026-11-19', { skipped: true }).settings.tour.skipped, true);
  assert.equal(seen.settings.tour.skipped, undefined);
});

test('Help plays it again, also on a phone that never ran setup', () => {
  const again = replayTour(finishTour(fresh, '2026-11-19'), '2026-11-20');
  assert.equal(tourDue(again), true);
  assert.equal(again.setup.done_on, '2026-11-19', 'setup date kept');
  const old = replayTour({ settings: { a: 1 }, setup: undefined }, '2026-11-20');
  assert.equal(tourDue(old), true);
  assert.equal(old.settings.a, 1);
});

test('stops for missing controls are left out, the hello card stays', () => {
  const all = TOUR.map((s) => s.target).filter(Boolean);
  assert.equal(tourStops(all).length, TOUR.length);
  const noMeals = tourStops(all.filter((x) => x !== 'tab-meals' && x !== 'weight'));
  assert.ok(!noMeals.some((s) => s.id === 'meals' || s.id === 'weight'));
  assert.equal(tourStops([])[0].id, 'hello');
  assert.equal(new Set(TOUR.map((s) => s.id)).size, TOUR.length, 'ids are unique');
});

test('the tip sits under the control, else above, else on screen', () => {
  const view = { height: 780, top: 24, bottom: 16 };
  assert.deepEqual(placeTip({ top: 100, bottom: 300 }, view, 180), { top: 312, side: 'below' });
  assert.deepEqual(placeTip({ top: 700, bottom: 760 }, view, 180), { top: 508, side: 'above' });
  assert.equal(placeTip({ top: 40, bottom: 700 }, view, 180).side, 'over');
  const mid = placeTip(null, view, 200);
  assert.equal(mid.side, 'middle');
  assert.equal(mid.top, 290);
});
