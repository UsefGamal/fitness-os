import assert from 'node:assert/strict';
import test from 'node:test';

import { isWorkSet } from './data.js';
import { cleanSet, isSetDefault, SET_DEFAULTS, SET_FIELDS, SET_TYPES, setFields, setLabel, setWith, TRACKS, typeDefault } from './sets.js';

const plain = { id: 1, exercise_id: 2, set_number: 1, reps: 8, weight_kg: 40, rpe: null, rir: null, is_warmup: false };

test('a set without the fields reads as a plain work set', () => {
  assert.deepEqual(setFields(plain), SET_DEFAULTS);
  assert.deepEqual(setFields({ ...plain, is_warmup: true }), { ...SET_DEFAULTS, set_type: 'warmup' });
  assert.deepEqual(setFields(null), SET_DEFAULTS);
  assert.deepEqual(Object.keys(SET_DEFAULTS), SET_FIELDS);
  assert.equal(typeDefault({ is_warmup: 'yes' }), 'work');
});

test('fields are stored only when they differ from the default', () => {
  assert.equal(cleanSet(plain), plain, 'nothing to change: the same object');
  assert.deepEqual(cleanSet({ ...plain, ...SET_DEFAULTS }), plain);
  const drop = setWith(plain, { set_type: 'drop', group: 'A' });
  assert.deepEqual(drop, { ...plain, set_type: 'drop', group: 'A' });
  assert.equal(cleanSet(drop), drop);
  assert.deepEqual(setWith(drop, { set_type: 'work', group: null }), plain, 'back to the default removes the field');
  assert.deepEqual(setWith(plain, { reps: 99, colour: 'red' }), plain, 'only the six fields can be set this way');
  // A warm-up marked both ways keeps one mark.
  assert.deepEqual(cleanSet({ ...plain, is_warmup: true, set_type: 'warmup' }), { ...plain, is_warmup: true });
  assert.deepEqual(cleanSet({ ...plain, set_type: 'warmup' }), { ...plain, set_type: 'warmup' });
});

test('every allowed value is kept and every range is enforced', () => {
  for (const set_type of SET_TYPES.filter((t) => t !== 'work')) assert.equal(setWith(plain, { set_type }).set_type, set_type);
  for (const track of TRACKS.filter((t) => t !== 'load')) assert.equal(setWith(plain, { track }).track, track);
  for (const [k, ok, bad] of [
    ['added_kg', [-200, -12.5, 0, 300], [-200.1, 300.1, '5', Number.NaN, Infinity]],
    ['distance_m', [0, 400, 100000], [-1, 100001, 1.5, '400']],
    ['duration_s', [0, 90, 86400], [-1, 86401, 0.5, true]],
    ['group', ['A', 'B2', 'ABCDEFGH'], ['', 'ABCDEFGHI', 5, {}]],
  ]) {
    for (const v of ok) assert.equal(setWith(plain, { [k]: v })[k], v, `${k} ${v}`);
    for (const v of bad) assert.equal(k in setWith(plain, { [k]: v }), false, `${k} ${String(v)}`);
  }
});

test('isWorkSet is still the one rule, and only warm-ups are not work sets', () => {
  assert.equal(isWorkSet(plain), true);
  assert.equal(isWorkSet({ ...plain, is_warmup: true }), false);
  assert.equal(isWorkSet(setWith(plain, { set_type: 'warmup' })), false);
  assert.equal(isWorkSet(setWith(plain, { set_type: 'drop' })), true);
  assert.equal(isWorkSet(setWith(plain, { set_type: 'failure' })), true);
  assert.equal(isWorkSet(setWith({ ...plain, is_warmup: true }, { set_type: 'work' })), false, 'is_warmup still wins');
  assert.equal(isWorkSet(null), false);
});

test('isSetDefault names the fields the data check code leaves out', () => {
  assert.equal(isSetDefault({ set_type: 'work' }, 'set_type'), true);
  assert.equal(isSetDefault({ set_type: 'warmup', is_warmup: true }, 'set_type'), true);
  assert.equal(isSetDefault({ set_type: 'warmup' }, 'set_type'), false);
  assert.equal(isSetDefault({ track: 'load' }, 'track'), true);
  assert.equal(isSetDefault({ track: 'time' }, 'track'), false);
  assert.equal(isSetDefault({ reps: null }, 'reps'), false);
});

test('set kinds: picked on the workout screen, warm-ups drop out of work sets', async () => {
  const { isWorkSet } = await import('./data.js');
  const { typeChoices, withType, TYPE_LETTER } = await import('./sets.js');
  const s = { id: 1, exercise_id: 1, set_number: 1, reps: 10, weight_kg: 40, is_warmup: false };
  const warm = withType(s, 'warmup');
  assert.equal(warm.is_warmup, true);
  assert.equal(isWorkSet(warm), false);
  assert.equal('set_type' in warm, false, 'a warm-up flagged is_warmup keeps set_type sparse');
  const drop = withType(s, 'drop');
  assert.equal(drop.set_type, 'drop');
  assert.equal(isWorkSet(drop), true);
  // Back to a work set: nothing left behind.
  const back = withType(drop, 'work');
  assert.deepEqual(back, s);
  assert.equal(withType(s, 'bogus'), s);
  assert.deepEqual(typeChoices(), ['work', 'warmup', 'drop', 'failure']);
  assert.deepEqual(typeChoices({ gentle: true }), ['work', 'warmup', 'drop']);
  assert.equal(TYPE_LETTER.work, undefined);
});

test('setLabel: kg × reps, or seconds for a timed hold', () => {
  assert.equal(setLabel({ weight_kg: 60, reps: 8 }), '60 kg × 8');
  assert.equal(setLabel({ weight_kg: 0, reps: 45, track: 'time', duration_s: 45 }), '45 s');
  assert.equal(setLabel({ weight_kg: 10, reps: 30, track: 'time', duration_s: 30 }), '30 s + 10 kg');
});
