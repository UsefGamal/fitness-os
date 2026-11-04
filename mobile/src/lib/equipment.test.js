import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSession, buildSwaps, canDo, ownedKinds } from './equipment.js';

const e = (id, name, equipment, primary, extra = {}) => ({ id, name, equipment, primary, secondary: [], category: 'strength', force: 'push', mechanic: 'compound', ...extra });
const entries = [
  e('bb_bench', 'Barbell Bench Press', 'barbell', ['chest']),
  e('db_bench', 'Dumbbell Bench Press', 'dumbbell', ['chest']),
  e('pushup', 'Pushups', 'body only', ['chest']),
  e('leg_ext', 'Leg Extensions', 'machine', ['quadriceps'], { mechanic: 'isolation' }),
];
const catalogue = { exercises: entries, byId: new Map(entries.map((x) => [x.id, x])) };
const training = { exercise_photos: { 'Bench': 'bb_bench', 'Leg Extension': 'leg_ext' } };
const day = { exercises: [{ name: 'Bench' }, { name: 'Leg Extension' }, { name: 'Mystery Drill' }] };

test('owned equipment: null is a full gym, bodyweight always works', () => {
  assert.equal(ownedKinds({}), null);
  assert.deepEqual(ownedKinds({ equipment: [] }), []);
  assert.equal(canDo(entries[0], null), true);
  assert.equal(canDo(entries[0], ['Dumbbell']), false);
  assert.equal(canDo(entries[2], []), true);
});

test('build swaps what you can not do for the closest one you can', () => {
  const home = buildSession(day, { training, catalogue, owned: ['Dumbbell'] });
  assert.deepEqual(home.map((b) => b.status), ['swap', 'none', 'unknown']);
  assert.equal(home[0].to.name, 'Dumbbell Bench Press');
  assert.deepEqual(buildSwaps(home), { 0: 'Dumbbell Bench Press' });
  const hotel = buildSession(day, { training, catalogue, owned: [] });
  assert.equal(hotel[0].to.name, 'Pushups');
  assert.deepEqual(buildSession(day, { training, catalogue, owned: null }).map((b) => b.status), ['keep', 'keep', 'keep']);
});

test('two exercises that need the same swap get different ones', () => {
  const two = { exercises: [{ name: 'Bench' }, { name: 'Bench Again' }] };
  const t = { exercise_photos: { Bench: 'bb_bench', 'Bench Again': 'bb_bench' } };
  const b = buildSession(two, { training: t, catalogue, owned: ['Dumbbell'] });
  assert.deepEqual(b.map((x) => x.to.name), ['Dumbbell Bench Press', 'Pushups']);
});
