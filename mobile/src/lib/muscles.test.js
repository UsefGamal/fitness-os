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

// ── Hand-checked plan exercises and angle regions on the body map ───────
import { REGION_OF, dayMuscles, partBox, targetFor, targetLabel } from './muscles.js';
import { BACK, FRONT } from '../components/muscleShapes.js';
import { content } from './testContent.js';

test('every hand-checked exercise uses known muscles and angles', () => {
  const targets = content.training.exercise_targets;
  assert.ok(Object.keys(targets).length >= 40);
  for (const [name, t] of Object.entries(targets)) {
    for (const m of [...t.main, ...t.helpers]) assert.ok(MUSCLE[m], `${name}: ${m}`);
    if (t.angle) assert.ok(ANGLES[t.angle], `${name}: ${t.angle}`);
  }
});

test('every plan exercise has a hand-checked target', () => {
  for (const d of content.training.program) for (const ex of d.exercises) assert.ok(content.training.exercise_targets[ex.name], ex.name);
});

test('the table wins over the photo entry; rules fill the rest', () => {
  const T = content.training;
  const photo = ex('Wide-Grip Lat Pulldown', ['lats'], ['biceps']);
  assert.deepEqual(targetFor('Upper Back Pulldown', T, photo).main, ['middle back', 'rear delts']);
  assert.equal(targetFor('Somebody Else Pulldown', T, photo).angle, 'lats_width');
  assert.equal(targetFor('Unknown', T), null);
  assert.equal(targetLabel(targetFor('15° Incline DB Press', T)), 'Upper chest');
  assert.equal(targetLabel(targetFor('Leg Extension', T)), 'Quads');
  assert.equal(targetLabel(null), '');
});

test('a day lights its exact muscles and passes unknown ones back', () => {
  const T = content.training;
  const r = dayMuscles([{ name: 'Y Cable Lateral Raise' }, { name: 'My Own Move', muscle_group: 'Arms' }], T);
  assert.deepEqual(r.muscles, ['side delts']);
  assert.deepEqual(r.unknown.map((e) => e.name), ['My Own Move']);
  assert.deepEqual(dayMuscles(undefined, T), { muscles: [], unknown: [] });
});

test('every angle region names an outline the drawing has', () => {
  const names = new Set([...FRONT, ...BACK].map(([m]) => m));
  for (const [k, r] of Object.entries(REGION_OF)) {
    assert.ok(ANGLES[k], k);
    assert.ok(names.has(r.shape), `${k}: ${r.shape}`);
  }
});

test('angle parts are cut from the outline box, mirrored at the midline', () => {
  const sq = '10 0 20 0 20 10 10 10'; // left of the midline at 50
  assert.deepEqual(partBox(sq, 'top'), { x: 10, y: 0, width: 10, height: 5 });
  assert.deepEqual(partBox(sq, 'bottom'), { x: 10, y: 5.5, width: 10, height: 4.5 });
  assert.equal(partBox(sq, 'outer').x, 10, 'outer is away from the midline');
  assert.equal(partBox(sq, 'inner').x, 14.5);
  const right = '80 0 90 0 90 10 80 10';
  assert.equal(partBox(right, 'outer').x, 84.5);
  assert.equal(partBox(right, 'inner').x, 80);
  assert.deepEqual(partBox(sq, 'whole'), { x: 10, y: 0, width: 10, height: 10 });
  assert.equal(partBox(sq, 'middle').height.toFixed(2), '4.70');
});

test('each head is its own outline, and pickOutlines still sorts a mixed list', async () => {
  const { pickOutlines } = await import('./muscles.js');
  const of = (shapes, m) => shapes.find(([x]) => x === m)[1];
  // Back: two triceps heads per arm; front: two biceps heads and the long head of the triceps.
  assert.equal(of(BACK, 'triceps-lateral').length, 2);
  assert.equal(of(BACK, 'triceps-long').length, 2);
  assert.equal(of(FRONT, 'biceps-long').length, 2);
  assert.equal(of(FRONT, 'biceps-short').length, 2);
  assert.equal(of(FRONT, 'triceps-long').length, 2);
  const tri = [...of(BACK, 'triceps-lateral'), ...of(BACK, 'triceps-long')];
  assert.deepEqual(pickOutlines(tri, 'smallest'), [2, 3]);
  assert.deepEqual(pickOutlines(tri, 'largest'), [0, 1]);
  assert.deepEqual(pickOutlines(tri), [0, 1, 2, 3]);
});

test('the drawing has every outline the muscles and angles name', () => {
  const drawn = new Set([...FRONT, ...BACK].map(([m]) => m));
  for (const [muscle, shapes] of Object.entries(SHAPES_OF)) for (const sh of shapes) assert.ok(drawn.has(sh), `${muscle} -> ${sh}`);
  for (const [angle, r] of Object.entries(REGION_OF)) assert.ok(drawn.has(r.shape), `${angle} -> ${r.shape}`);
  for (const m of MUSCLES) for (const sh of m.shapes) assert.ok(drawn.has(sh), `${m.key} -> ${sh}`);
});

test('the chest is drawn larger than the traps above it, and the back is in four parts', () => {
  const area = (points) => { const b = partBox(points, 'whole'); return b.width * b.height; };
  const of = (shapes, m) => shapes.find(([x]) => x === m)[1];
  assert.ok(area(of(FRONT, 'chest')[0]) > 4 * area(of(FRONT, 'trapezius')[0]));
  assert.ok(area(of(FRONT, 'chest')[0]) > area(of(BACK, 'trapezius')[0]));
  for (const m of ['trapezius', 'trapezius-mid', 'upper-back', 'lats']) assert.equal(of(BACK, m).length, 2, m);
});
