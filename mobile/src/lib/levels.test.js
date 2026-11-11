import assert from 'node:assert/strict';
import test from 'node:test';

import { isAdvanced, levelFromSetup, swapOptions } from './levels.js';

const ex = (id, name, level, equipment) => ({ id, name, level, equipment, category: 'strength', primary: ['chest'], secondary: ['triceps'], force: 'push', mechanic: 'compound' });
const bench = ex('bench', 'Barbell Bench Press', 'intermediate', 'barbell');
const all = [
  bench,
  ex('db', 'Dumbbell Bench Press', 'beginner', 'dumbbell'),
  ex('pushup', 'Push-Up', 'beginner', 'body only'),
  ex('plyo', 'Plyo Push-Up Press', 'expert', 'body only'),
  ex('machine', 'Machine Chest Press', 'beginner', 'machine'),
  { ...ex('curl', 'Curl', 'beginner', 'dumbbell'), primary: ['biceps'], secondary: [] },
];

test('setup experience maps to a level', () => {
  assert.equal(levelFromSetup('new'), 'beginner');
  assert.equal(levelFromSetup('some'), 'intermediate');
  assert.equal(levelFromSetup(undefined), 'beginner');
});

test('advanced means above the person, never when a level is unknown', () => {
  assert.equal(isAdvanced('expert', 'beginner'), true);
  assert.equal(isAdvanced('intermediate', 'beginner'), true);
  assert.equal(isAdvanced('intermediate', 'intermediate'), false);
  assert.equal(isAdvanced('beginner', 'expert'), false);
  assert.equal(isAdvanced('expert', null), false);
  assert.equal(isAdvanced(undefined, 'beginner'), false);
});

test('swap options share the main muscle and nothing is hidden', () => {
  const names = swapOptions(bench, all, { level: 'beginner' }).map((r) => r.entry.name);
  assert.equal(names.includes('Curl'), false);
  assert.equal(names.includes('Barbell Bench Press'), false);
  assert.equal(names.includes('Plyo Push-Up Press'), true); // labelled, not hidden
  assert.equal(names.at(-1), 'Plyo Push-Up Press'); // above the level goes last
});

test('swap options put what the equipment allows first', () => {
  const r = swapOptions(bench, all, { level: 'beginner', owned: ['Dumbbell'] });
  assert.deepEqual(r.filter((x) => x.doable).map((x) => x.entry.id).sort(), ['db', 'plyo', 'pushup']);
  assert.equal(r.at(-1).entry.id, 'machine');
  assert.equal(r.find((x) => x.entry.id === 'plyo').advanced, true);
  assert.equal(r[2].entry.id, 'plyo'); // doable but advanced: after the doable beginner ones
});

test('exercises already in the session are skipped, and the list is capped', () => {
  const r = swapOptions(bench, all, { skip: ['push-up'], limit: 2 });
  assert.equal(r.length, 2);
  assert.equal(r.some((x) => x.entry.id === 'pushup'), false);
});
