import assert from 'node:assert/strict';
import test from 'node:test';

import { alternatives, byCluster, clusterOf, forGroup, sharedMuscles, sharedWords, similarity } from './similar.js';

const E = (id, primary, secondary = [], extra = {}) => ({
  id, name: id.replace(/_/g, ' '), primary, secondary,
  equipment: 'barbell', category: 'strength', force: 'push', mechanic: 'compound', level: 'beginner', ...extra,
});

const bench = E('Barbell_Bench_Press', ['chest'], ['shoulders', 'triceps']);
const dbBench = E('Dumbbell_Bench_Press', ['chest'], ['shoulders', 'triceps'], { equipment: 'dumbbell' });
const pushup = E('Pushups', ['chest'], ['shoulders', 'triceps'], { equipment: 'body only' });
const fly = E('Cable_Crossover', ['chest'], ['shoulders'], { equipment: 'cable', mechanic: 'isolation' });
const pushdown = E('Triceps_Pushdown', ['triceps'], [], { equipment: 'cable', mechanic: 'isolation' });
const chestStretch = E('Chest_Stretch', ['chest'], [], { equipment: 'body only', category: 'stretching', force: 'static', mechanic: null });
const squat = E('Barbell_Squat', ['quadriceps'], ['glutes', 'hamstrings']);
const legPress = E('Leg_Press', ['quadriceps'], ['glutes', 'hamstrings'], { equipment: 'machine' });
const all = [bench, dbBench, pushup, fly, pushdown, chestStretch, squat, legPress];

test('the same muscles and movement score highest', () => {
  assert.ok(similarity(bench, dbBench) > 0.9);
  assert.ok(similarity(bench, dbBench) > similarity(bench, fly));
  assert.ok(similarity(bench, fly) > 0.35);
});

test('no shared main muscle, or a different kind of work, scores zero', () => {
  assert.equal(similarity(bench, pushdown), 0);
  assert.equal(similarity(bench, squat), 0);
  assert.equal(similarity(bench, chestStretch), 0);
});

test('alternatives are ranked best first and never include the exercise itself', () => {
  const ids = alternatives(bench, all).map((r) => r.entry.id);
  assert.equal(ids[0], 'Dumbbell_Bench_Press');
  assert.ok(!ids.includes('Barbell_Bench_Press'));
  assert.ok(!ids.includes('Barbell_Squat'));
  assert.deepEqual(alternatives(squat, all).map((r) => r.entry.id), ['Leg_Press']);
});

test('alternatives are grouped by equipment in a fixed order', () => {
  const groups = byCluster(alternatives(bench, all));
  assert.deepEqual(groups.map((g) => g.cluster), ['Dumbbell', 'Cable', 'Bodyweight']);
  assert.equal(byCluster(alternatives(bench, all), 1).every((g) => g.items.length === 1), true);
});

test('equipment folds into clusters', () => {
  assert.equal(clusterOf('e-z curl bar'), 'Barbell');
  assert.equal(clusterOf(null), 'Bodyweight');
  assert.equal(clusterOf('bands'), 'Kettlebell & bands');
  assert.equal(clusterOf('medicine ball'), 'Other');
});

test('an exercise with no catalogue match gets strength work for its muscle group', () => {
  const ids = forGroup('Chest', all).map((r) => r.entry.id);
  assert.ok(ids.includes('Pushups'));
  assert.ok(!ids.includes('Chest_Stretch'));
  assert.ok(!ids.includes('Triceps_Pushdown'));
});

test('the reason line names the muscles both work', () => {
  assert.deepEqual(sharedMuscles(bench, fly), ['chest', 'shoulders']);
  assert.equal(sharedWords('Side Lateral Raise', 'Seated Side Lateral Raise'), 3);
  assert.equal(sharedWords('Barbell Squat', 'Dumbbell Squat'), 1);
});
