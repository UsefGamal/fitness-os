// E4-S16: finer muscles and angles from the exercise name.
import assert from 'node:assert/strict';
import test from 'node:test';

import { ANGLES, MUSCLE, MUSCLES, angleOf, anglesOf, deltOf, helpersOf, musclesIn, musclesOf, targetText } from './muscles.js';
import { MUSCLE_GROUP } from './catalogue.js';
import { SHAPES_OF } from './muscleMap.js';

const ex = (name, primary, secondary = []) => ({ name, primary, secondary });

test('every catalogue muscle has a finer muscle in the same group', () => {
  for (const [m, group] of Object.entries(MUSCLE_GROUP)) {
    const f = m === 'shoulders' ? 'front delts' : m;
    assert.ok(MUSCLE[f], m);
    assert.equal(MUSCLE[f].group, group, m);
  }
});

test('every muscle lights an outline the body map has', () => {
  const known = new Set(Object.values(SHAPES_OF).flat());
  for (const m of MUSCLES) for (const s of m.shapes) assert.ok(known.has(s), `${m.key}: ${s}`);
});

test('every angle belongs to a known muscle', () => {
  for (const [k, a] of Object.entries(ANGLES)) assert.ok(MUSCLE[a.muscle], k);
});

test('deltoid heads from the name', () => {
  const cases = [
    ['Side Lateral Raise', 'side delts'],
    ['Upright Barbell Row', 'side delts'],
    ['Y Cable Lateral Raise', 'side delts'],
    ['Reverse Flyes', 'rear delts'],
    ['Face Pull', 'rear delts'],
    ['Bent Over Dumbbell Rear Delt Raise With Head On Bench', 'rear delts'],
    ['Seated Bent-Over Rear Delt Raise', 'rear delts'],
    ['Reverse Machine Flyes', 'rear delts'],
    ['Dumbbell Shoulder Press', 'front delts'],
    ['Front Dumbbell Raise', 'front delts'],
    ['Arnold Dumbbell Press', 'front delts'],
  ];
  for (const [n, want] of cases) assert.equal(deltOf(ex(n, ['shoulders'])), want, n);
});

test('shoulders become a deltoid head; other muscles stay', () => {
  assert.deepEqual(musclesOf(ex('Side Lateral Raise', ['shoulders'])), ['side delts']);
  assert.deepEqual(musclesOf(ex('Barbell Curl', ['biceps'])), ['biceps']);
  assert.deepEqual(musclesOf({}), []);
});

test('pressing helpers are front delts, never the main muscle twice', () => {
  assert.deepEqual(helpersOf(ex('Incline Dumbbell Press', ['chest'], ['shoulders', 'triceps'])), ['front delts', 'triceps']);
  assert.deepEqual(helpersOf(ex('Face Pull', ['shoulders'], ['shoulders', 'middle back'])), ['middle back']);
});

test('chest angles', () => {
  assert.equal(angleOf(ex('Incline Dumbbell Press', ['chest'])), 'upper_chest');
  assert.equal(angleOf(ex('15° Incline DB Press', ['chest'])), 'upper_chest');
  assert.equal(angleOf(ex('Decline Barbell Bench Press', ['chest'])), 'lower_chest');
  assert.equal(angleOf(ex('Dips - Chest Version', ['chest'])), 'lower_chest');
  assert.equal(angleOf(ex('Dumbbell Flyes', ['chest'])), 'mid_chest');
  assert.equal(angleOf(ex('Pushups', ['chest'])), 'mid_chest');
  assert.equal(angleOf(ex('Chest Stretch on Stability Ball', ['chest'])), null);
});

test('biceps and triceps heads', () => {
  assert.equal(angleOf(ex('Hammer Curls', ['biceps'])), 'brachialis');
  assert.equal(angleOf(ex('Reverse Barbell Curl', ['biceps'])), 'brachialis');
  assert.equal(angleOf(ex('Incline Cable Curl', ['biceps'])), 'biceps_long');
  assert.equal(angleOf(ex('Incline Dumbbell Curl', ['biceps'])), 'biceps_long');
  assert.equal(angleOf(ex('Preacher Curl', ['biceps'])), 'biceps_short');
  assert.equal(angleOf(ex('Concentration Curls', ['biceps'])), 'biceps_short');
  assert.equal(angleOf(ex('Barbell Curl', ['biceps'])), null);
  assert.equal(angleOf(ex('1-Arm Overhead Cable Extension', ['triceps'])), 'triceps_long');
  assert.equal(angleOf(ex('EZ-Bar Skullcrusher', ['triceps'])), 'triceps_long');
  assert.equal(angleOf(ex('Triceps Pushdown - Rope Attachment', ['triceps'])), 'triceps_lateral');
  assert.equal(angleOf(ex('Tricep Dumbbell Kickback', ['triceps'])), 'triceps_lateral');
  assert.equal(angleOf(ex('Close-Grip Barbell Bench Press', ['triceps'])), 'triceps_all');
  assert.equal(angleOf(ex('Dips - Triceps Version', ['triceps'])), 'triceps_all');
  assert.equal(angleOf(ex('Standing Dumbbell Triceps Extension', ['triceps'])), 'triceps_long');
  assert.equal(angleOf(ex('Standing Bent-Over One-Arm Dumbbell Triceps Extension', ['triceps'])), 'triceps_lateral');
  assert.equal(angleOf(ex('Standing Inner-Biceps Curl', ['biceps'])), 'biceps_short');
  assert.equal(deltOf(ex('Band Pull Apart', ['shoulders'])), 'rear delts');
});

test('back width and thickness', () => {
  assert.equal(angleOf(ex('Wide-Grip Lat Pulldown', ['lats'])), 'lats_width');
  assert.equal(angleOf(ex('NG Lat Pulldown', ['lats'])), 'lats_width');
  assert.equal(angleOf(ex('Chin-Up', ['lats'])), 'lats_width');
  assert.equal(angleOf(ex('Seated Cable Rows', ['middle back'])), 'back_thickness');
  assert.equal(angleOf(ex('Bent Over Two-Dumbbell Row', ['middle back'])), 'back_thickness');
  assert.equal(angleOf(ex('Barbell Squat', ['quadriceps'])), null);
});

test('lists and labels', () => {
  assert.deepEqual(musclesIn('Shoulders').map((m) => m.key), ['front delts', 'side delts', 'rear delts', 'neck']);
  assert.deepEqual(musclesIn('Arms').map((m) => m.key), ['biceps', 'triceps', 'forearms']);
  assert.deepEqual(anglesOf('triceps').map((a) => a.key), ['triceps_long', 'triceps_lateral', 'triceps_all']);
  assert.deepEqual(anglesOf('biceps').map((a) => a.key), ['biceps_long', 'biceps_short', 'brachialis']);
  assert.equal(targetText(ex('Incline Dumbbell Press', ['chest'])), 'Upper chest');
  assert.equal(targetText(ex('Side Lateral Raise', ['shoulders'])), 'Side delts');
  assert.equal(targetText(ex('Barbell Squat', ['quadriceps', 'glutes'])), 'Quads, Glutes');
});
