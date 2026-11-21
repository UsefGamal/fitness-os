import assert from 'node:assert/strict';
import test from 'node:test';

import { AWAY_MS, INTRO_MS, PHI, goldenLayout, introKind, introLine, isNewOpen, shouldPlayIntro, slitDir } from './intro.js';

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
  assert.equal(introLine({ next: push, time: '07:00', firstRun: true }), '');
  assert.equal(introLine({ next: null, time: '07:00' }), '');
});

test('coming back after a minute away counts as a new open', () => {
  assert.equal(isNewOpen(AWAY_MS), true);
  assert.equal(isNewOpen(10 * 60 * 1000), true);
  assert.equal(isNewOpen(AWAY_MS - 1), false);
  assert.equal(isNewOpen(5000), false);
  assert.equal(isNewOpen(NaN), false);
});

test('the full leap plays once a day, a short jump after that, a fade with reduced motion', () => {
  assert.equal(introKind({ hash: '', today: '2026-11-20', lastFullOn: null }), 'full');
  assert.equal(introKind({ hash: '', today: '2026-11-20', lastFullOn: '2026-11-19' }), 'full');
  assert.equal(introKind({ hash: '', today: '2026-11-20', lastFullOn: '2026-11-20' }), 'short');
  assert.equal(introKind({ hash: '', today: '2026-11-20', reducedMotion: true }), 'fade');
  assert.equal(introKind({ hash: '#/workout', today: '2026-11-20' }), null);
  assert.equal(introKind({ hash: '', today: '2026-11-20', activeWorkout: true, reducedMotion: true }), null);
  assert.ok(INTRO_MS.full <= 2000 && INTRO_MS.short <= 800 && INTRO_MS.fade === 200);
});

test('the mark flies along the slit of the ط, up and to the right', () => {
  const [x, y] = slitDir();
  assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9);
  const deg = Math.atan2(-y, x) * 180 / Math.PI;
  assert.ok(deg > 22 && deg < 28, `slit angle ${deg}`);
});

test('the intro page keeps to the golden ratio', () => {
  const g = goldenLayout(844, 104);
  assert.equal(g.title, Math.round(104 / PHI / PHI));
  assert.equal(g.sub, Math.round(g.title / PHI / PHI));
  assert.equal(g.pad, Math.round(104 / PHI));
  assert.ok(g.markY < 844 / 2 && g.titleTop > g.markY && g.subTop > g.titleTop);
});
