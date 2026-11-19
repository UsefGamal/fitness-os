import assert from 'node:assert/strict';
import test from 'node:test';

import { FRONT, BACK } from '../components/muscleShapes.js';
import { countByGroup, exerciseGroups, GROUP_OF_OUTLINE, GROUP16, GROUPS16, groupOfMuscle, groupStats, groupsOfTarget, inGroup, musclesOfGroup, outlinesOf, recoveryOf } from './muscleGroups.js';
import { MUSCLES, musclesOf } from './muscles.js';
import { smoothPath } from './muscleMap.js';

test('16 groups, and every muscle belongs to exactly one', () => {
  assert.equal(GROUPS16.length, 16);
  assert.equal(new Set(GROUPS16.map((g) => g.key)).size, 16);
  for (const m of MUSCLES) assert.ok(groupOfMuscle(m.key), m.key);
  const all = GROUPS16.flatMap((g) => g.muscles);
  assert.equal(new Set(all).size, all.length);
  assert.equal(groupOfMuscle('shoulders'), 'shoulders');
  assert.equal(groupOfMuscle('nope'), null);
});

test('every drawn muscle outline has one group, and every group is drawn', () => {
  const drawn = new Set([...FRONT, ...BACK].map(([m]) => m));
  for (const o of Object.keys(GROUP_OF_OUTLINE)) assert.ok(drawn.has(o), o);
  for (const g of GROUPS16) assert.ok(outlinesOf(g.key).length, g.key);
  for (const o of drawn) if (!['head', 'knees'].includes(o)) assert.ok(GROUP_OF_OUTLINE[o], `${o} has no group`);
});

test('a target folds into main and helper groups', () => {
  assert.deepEqual(groupsOfTarget({ main: ['chest'], helpers: ['front delts', 'triceps', 'side delts'] }), { main: ['chest'], helpers: ['shoulders', 'triceps'] });
  assert.deepEqual(groupsOfTarget({ main: ['lats', 'middle back'], helpers: ['lats', 'biceps'] }), { main: ['back'], helpers: ['biceps'] });
  assert.deepEqual(groupsOfTarget(null), { main: [], helpers: [] });
});

test('twists and side planks work the obliques; crunches the abs', () => {
  assert.deepEqual(musclesOf({ name: 'Russian Twist', primary: ['abdominals'] }), ['obliques']);
  assert.deepEqual(musclesOf({ name: 'Side Bridge', primary: ['abdominals'] }), ['obliques']);
  assert.deepEqual(musclesOf({ name: 'Crunches', primary: ['abdominals'] }), ['abdominals']);
});

test('the person\'s exercises: table first, then catalogue, then the old group', () => {
  const training = { exercise_targets: { 'Bench Press': { main: ['chest'], helpers: ['triceps'] } } };
  assert.deepEqual(exerciseGroups({ name: 'Bench Press', muscle_group: 'Chest' }, training), { main: ['chest'], helpers: ['triceps'] });
  assert.deepEqual(exerciseGroups({ name: 'Hammer Curl', muscle_group: 'Arms' }, training, { name: 'Hammer Curls', primary: ['biceps'], secondary: ['forearms'] }), { main: ['biceps'], helpers: ['forearms'] });
  assert.deepEqual(exerciseGroups({ name: 'My move', muscle_group: 'Arms' }, training), { main: ['biceps', 'triceps'], helpers: [] });
  assert.deepEqual(exerciseGroups({ name: 'Odd', muscle_group: 'Nope' }, training), { main: [], helpers: [] });
});

test('filters and counts by group', () => {
  const t = [{ main: ['front delts'] }, { main: ['side delts'] }, { main: ['chest'] }];
  assert.ok(inGroup(t[0], 'shoulders'));
  assert.ok(!inGroup(t[0], 'shoulders', 'side delts'));
  assert.ok(inGroup(t[1], 'shoulders', 'side delts'));
  const c = countByGroup(t);
  assert.equal(c.shoulders, 2);
  assert.equal(c.chest, 1);
  assert.equal(c.abs, 0);
  assert.deepEqual(musclesOfGroup('shoulders'), ['front delts', 'side delts', 'rear delts']);
  assert.deepEqual(musclesOfGroup('calves'), ['calves']);
  assert.equal(GROUP16.back.label, 'Back');
});

test('sets this week and last trained per group, from every logged set', () => {
  const data = { workouts: [
    { log_date: '2026-11-18', sets: [{ exercise_id: 1 }, { exercise_id: 1 }, { exercise_id: 2, is_warmup: true }] },
    { log_date: '2026-11-01', sets: [{ exercise_id: 2 }] },
    { log_date: '2026-11-25', sets: [{ exercise_id: 1 }] },
  ] };
  let calls = 0;
  const of = (id) => { calls += 1; return id === 1 ? { main: ['chest'], helpers: ['triceps'] } : { main: ['quads'], helpers: [] }; };
  const s = groupStats(data, of, '2026-11-19');
  assert.deepEqual(s.chest, { sets: 2, last: '2026-11-18' });
  assert.deepEqual(s.triceps, { sets: 1, last: null });
  assert.deepEqual(s.quads, { sets: 0, last: '2026-11-01' });
  assert.ok(calls <= 2, 'each exercise looked up once');
});

test('recovery from the last day trained', () => {
  assert.equal(recoveryOf(null, '2026-11-19'), 'untrained');
  assert.equal(recoveryOf('2026-11-18', '2026-11-19'), 'recovering');
  assert.equal(recoveryOf('2026-11-16', '2026-11-19'), 'ready');
  assert.equal(recoveryOf('2026-11-12', '2026-11-19'), 'untrained');
});

test('smooth outlines are closed curves through the corners', () => {
  const d = smoothPath('0 0 10 0 10 10 0 10');
  assert.match(d, /^M0 0C/);
  assert.equal((d.match(/C/g) || []).length, 4);
  assert.ok(d.endsWith('Z'));
  assert.equal(smoothPath('1 2 3 4'), '');
  assert.equal(smoothPath('0 0 10 0 10 10', 0), 'M0 0C0 0 10 0 10 0C10 0 10 10 10 10C10 10 0 0 0 0Z');
});
