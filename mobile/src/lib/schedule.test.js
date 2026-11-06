// Same cases as tests/test_gym_program.py. Change both together.
import assert from 'node:assert/strict';
import test from 'node:test';

import { moveSession, moveTargets, programDayFor, restSeconds, sessionKeyOn, tileLabel, undoMove, weekView } from './schedule.js';
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

// ── Picking the session for one day (friend feedback, 6 Nov 2026) ───────
import { isChangedOn, setSessionOn } from './schedule.js';

test('picking another session for today changes only today', () => {
  const d = setSessionOn({ session_moves: [] }, T, '2026-11-05', 'push');
  assert.equal(sessionKeyOn('2026-11-05', T, d.session_moves), 'push');
  assert.equal(sessionKeyOn('2026-11-04', T, d.session_moves), 'push', 'the planned push day is untouched');
  assert.equal(sessionKeyOn('2026-11-12', T, d.session_moves), 'pull', 'next week is the plan again');
  assert.ok(isChangedOn('2026-11-05', d.session_moves));
});

test('a rest day can become a training day and back', () => {
  const d = setSessionOn({ session_moves: [] }, T, '2026-11-03', 'upper');
  assert.equal(sessionKeyOn('2026-11-03', T, d.session_moves), 'upper');
  assert.equal(programDayFor('2026-11-03', T, d.session_moves).isRestToday, false);
  const back = setSessionOn(d, T, '2026-11-03', 'rest');
  assert.deepEqual(back.session_moves, [], 'picking the planned session drops the change');
});

test('a training day can become a rest day', () => {
  const d = setSessionOn({ session_moves: [] }, T, '2026-11-05', 'rest');
  assert.equal(sessionKeyOn('2026-11-05', T, d.session_moves), 'rest');
  assert.equal(programDayFor('2026-11-05', T, d.session_moves).label, 'Leg');
});

test('picking the same session again changes nothing', () => {
  const d0 = { session_moves: [] };
  assert.equal(setSessionOn(d0, T, '2026-11-05', 'pull'), d0);
});

test('changing a day a session was moved onto keeps its old day empty', () => {
  const moved = moveSession({ session_moves: [] }, T, '2026-11-02', '2026-11-03');
  const d = setSessionOn(moved, T, '2026-11-03', 'upper');
  assert.equal(sessionKeyOn('2026-11-03', T, d.session_moves), 'upper');
  assert.equal(sessionKeyOn('2026-11-02', T, d.session_moves), 'rest', 'Lower does not jump back to Monday');
});

test('a session picked for one day can still be moved, leaving that day empty', () => {
  const picked = setSessionOn({ session_moves: [] }, T, '2026-11-02', 'push');
  const d = moveSession(picked, T, '2026-11-02', '2026-11-03');
  assert.equal(sessionKeyOn('2026-11-03', T, d.session_moves), 'push');
  assert.equal(sessionKeyOn('2026-11-02', T, d.session_moves), 'rest');
});

test('undo puts a picked day back to the plan', () => {
  const d = undoMove(setSessionOn({ session_moves: [] }, T, '2026-11-05', 'push'), '2026-11-05');
  assert.equal(sessionKeyOn('2026-11-05', T, d.session_moves), 'pull');
});

test('week tiles keep session variants apart without an ellipsis', () => {
  assert.equal(tileLabel('Full body A'), 'FB A');
  assert.equal(tileLabel('Full body B'), 'FB B');
  assert.equal(tileLabel('Full body C'), 'FB C');
  assert.equal(tileLabel('Upper B'), 'Up B');
  assert.equal(tileLabel('Lower A (Home)'), 'Lo A');
  assert.equal(tileLabel('Push'), 'Push');
  assert.equal(tileLabel('Chest'), 'Chest');
  assert.equal(tileLabel('Shoulders'), 'Shoul');
  assert.equal(tileLabel('Chest & back'), 'CB');
  assert.equal(tileLabel('Day 12'), 'Da 12');
  assert.equal(tileLabel(''), '');
  for (const d of weekView('2026-11-01', content.training)) {
    assert.ok(d.tile.length <= 6, `${d.label} -> ${d.tile}`);
    assert.ok(!d.tile.includes('…'));
  }
});
