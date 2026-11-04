// Same cases as tests/test_gym_program.py. Change both together.
import assert from 'node:assert/strict';
import test from 'node:test';

import { moveSession, moveTargets, programDayFor, restSeconds, sessionKeyOn, undoMove, weekView } from './schedule.js';
import { content } from './testContent.js';

const T = content.training;
const WEEK = [
  ['2026-11-01', 'upper'],
  ['2026-11-02', 'lower'],
  ['2026-11-03', 'rest'],
  ['2026-11-04', 'push'],
  ['2026-11-05', 'pull'],
  ['2026-11-06', 'leg'],
  ['2026-11-07', 'rest'],
];

test('Sunday-start schedule', () => {
  for (const [day, key] of WEEK) assert.equal(sessionKeyOn(day, T), key, day);
});

test("a training day is that day's session", () => {
  const d = programDayFor('2026-11-04', T);
  assert.equal(d.label, 'Push');
  assert.equal(d.isRestToday, false);
  assert.equal(d.onDate, '2026-11-04');
});

test('a rest day points at the next session', () => {
  const tue = programDayFor('2026-11-03', T);
  assert.equal(tue.isRestToday, true);
  assert.equal(tue.label, 'Push');
  assert.equal(tue.onDate, '2026-11-04');
  const sat = programDayFor('2026-11-07', T);
  assert.equal(sat.label, 'Upper');
  assert.equal(sat.onDate, '2026-11-08');
});

test('week view starts on Sunday and marks today', () => {
  const week = weekView('2026-11-04', T);
  assert.deepEqual(week.map((d) => d.short), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.deepEqual(week.map((d) => d.label), ['Upper', 'Lower', 'Rest', 'Push', 'Pull', 'Leg', 'Rest']);
  assert.equal(week.findIndex((d) => d.isToday), 3);
});

test('rest seconds', () => {
  const cases = [['2m', 120], ['1.5-2m', 90], ['30s', 30], ['1.5m per arm', 90], ['45s per arm', 45], ['2-3m', 120], ['', null], [null, null]];
  for (const [text, s] of cases) assert.equal(restSeconds(text), s, String(text));
});

test('every working exercise is in the exercise library', () => {
  const lib = new Set(T.exercise_library.map((e) => e[1]));
  const missing = T.program.flatMap((d) => d.exercises.map((e) => e.name)).filter((n) => !lib.has(n));
  assert.deepEqual(missing, []);
});

test('a moved session shows on its new day and leaves a rest day behind', () => {
  const T = content.training;
  const week = weekView('2026-11-01', T); // Sunday start
  const from = week.find((d) => d.key !== 'rest').date;
  const to = moveTargets(from, T)[0];
  const data = moveSession({}, T, from, to);
  const moves = data.session_moves;
  assert.equal(sessionKeyOn(from, T, moves), 'rest');
  assert.equal(sessionKeyOn(to, T, moves), sessionKeyOn(from, T));
  assert.equal(weekView('2026-11-01', T, moves).find((d) => d.date === to).key, sessionKeyOn(from, T));
  // Moving it again keeps the original day, and undo puts it back.
  const again = moveTargets(to, T, moves).find((d) => d !== from);
  const twice = moveSession(data, T, to, again);
  assert.deepEqual(twice.session_moves.map((m) => [m.from, m.to]), [[from, again]]);
  assert.equal(sessionKeyOn(from, T, undoMove(twice, again).session_moves), sessionKeyOn(from, T));
  // A rest day has nothing to move.
  assert.equal(moveSession({}, T, '2026-11-03', '2026-11-04').session_moves, undefined);
});
