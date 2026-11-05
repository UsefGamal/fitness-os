import assert from 'node:assert/strict';
import test from 'node:test';

import { introLine, introOn, setIntro, shouldPlayIntro } from './intro.js';

const data = { settings: {} };

test('the intro plays on a plain launch to Home, on by default', () => {
  assert.equal(introOn(data), true);
  assert.equal(shouldPlayIntro({ data, hash: '' }), true);
  assert.equal(shouldPlayIntro({ data, hash: '#/' }), true);
});

test('the intro is skipped when off, on reduced motion, mid-workout or on a deep link', () => {
  assert.equal(shouldPlayIntro({ data: setIntro(data, false), hash: '' }), false);
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
