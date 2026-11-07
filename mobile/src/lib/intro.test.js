import assert from 'node:assert/strict';
import test from 'node:test';

import { AWAY_MS, introLine, isNewOpen, shouldPlayIntro } from './intro.js';

const data = { settings: {} };

test('the intro always plays on a plain open to Home, with no switch to turn it off', () => {
  assert.equal(shouldPlayIntro({ data: { settings: { intro: false } }, hash: '' }), true);
  assert.equal(shouldPlayIntro({ data, hash: '' }), true);
  assert.equal(shouldPlayIntro({ data, hash: '#/' }), true);
});

test('the intro is skipped on reduced motion, mid-workout or on a deep link', () => {
  assert.equal(shouldPlayIntro({ data, hash: '', reducedMotion: true }), false);
  assert.equal(shouldPlayIntro({ data, hash: '', activeWorkout: true }), false);
  assert.equal(shouldPlayIntro({ data, hash: '#/workout' }), false);
  assert.equal(shouldPlayIntro({ data, hash: '#/meals?x=1' }), false);
});

test('the intro line names today, the next session, or a welcome', () => {
  const push = { label: 'Push', isRestToday: false };
  assert.equal(introLine({ next: push, time: '07:00' }), 'Push today at 07:00');
  assert.equal(introLine({ next: push, time: '07:00', doneToday: true }), 'Push done today. Nice work');
  assert.equal(introLine({ next: { label: 'Pull', isRestToday: true }, time: '07:00' }), 'Rest day · next: Pull');
  assert.equal(introLine({ next: push, time: '07:00', firstRun: true }), "Let's build your week");
  assert.equal(introLine({ next: null, time: '07:00' }), '');
});

test('coming back after a minute away counts as a new open', () => {
  assert.equal(isNewOpen(AWAY_MS), true);
  assert.equal(isNewOpen(10 * 60 * 1000), true);
  assert.equal(isNewOpen(AWAY_MS - 1), false);
  assert.equal(isNewOpen(5000), false);
  assert.equal(isNewOpen(NaN), false);
});
