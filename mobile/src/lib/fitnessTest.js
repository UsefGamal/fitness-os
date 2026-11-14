// The fitness test (content/fitness_test.py): push-ups, squats in a minute
// and a plank hold, repeated every few weeks. Results live in
// data.fitness_tests, an additive key like my_foods: older backups simply
// don't have it and older builds carry it in _unknown, so there is no
// schema bump.
//
//   fitness_tests: [{ date: 'YYYY-MM-DD', results: { pushups: { value: 22, move: 'Push-up' }, ... } }]
//
// One test per day, oldest first. A result only compares with earlier
// results on the same move: 15 knee push-ups after 10 full ones is a
// different number, not a drop. Pure; fitnessTest.test.js.
import { daysBetween } from './dates.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_TESTS = 200;
/** Bounds for a result this build has no item for (a newer build's). */
const ANY_MAX = 10000;
const MAX_MOVE = 60;

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** A safe result for `item` from form input or a file, or null.
 * The move falls back to the item's first (standard) move. */
export function cleanResult(item, input) {
  if (!isObject(input)) return null;
  const raw = input.value;
  if (raw == null || raw === '') return null;
  const value = Math.round(Number(raw));
  const max = item?.max ?? ANY_MAX;
  if (!Number.isFinite(value) || value < 0 || value > max) return null;
  if (!item) {
    // A newer build's item: keep it as it came, within plain bounds.
    const move = typeof input.move === 'string' ? input.move.slice(0, MAX_MOVE) : null;
    return move ? { value, move } : { value };
  }
  const move = item.moves.includes(input.move) ? input.move : item.moves[0];
  return { value, move };
}

/** A safe test entry, or null when it has no date or no results. */
export function cleanEntry(raw, items) {
  if (!isObject(raw) || typeof raw.date !== 'string' || !ISO.test(raw.date) || !isObject(raw.results)) return null;
  const byKey = new Map((items || []).map((i) => [i.key, i]));
  const results = {};
  for (const [key, input] of Object.entries(raw.results)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const r = cleanResult(byKey.get(key), input);
    if (r) results[key] = r;
  }
  return Object.keys(results).length ? { date: raw.date, results } : null;
}

/** The person's tests, oldest first, one per day (the last one wins). */
export function testList(data) {
  const list = Array.isArray(data?.fitness_tests) ? data.fitness_tests : [];
  const byDate = new Map();
  for (const t of list) if (isObject(t) && typeof t.date === 'string' && isObject(t.results)) byDate.set(t.date, t);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Every entry of an imported file's list, cleaned (pentest JS-02). */
export function cleanTests(list, items) {
  if (!Array.isArray(list)) return [];
  return testList({ fitness_tests: list.map((t) => cleanEntry(t, items)).filter(Boolean) }).slice(-MAX_TESTS);
}

/** Save the results for `date`, replacing a test already on that day.
 * Nothing valid in `inputs` leaves the data as it was. */
export function saveTest(data, date, inputs, items) {
  const entry = cleanEntry({ date, results: inputs }, items);
  if (!entry) return data;
  const rest = testList(data).filter((t) => t.date !== date);
  return { ...data, fitness_tests: [...rest, entry].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_TESTS) };
}

export function deleteTest(data, date) {
  return { ...data, fitness_tests: testList(data).filter((t) => t.date !== date) };
}

/** For each item, the latest result with the one before it on the same
 * move, the change, and the best ever on that move. Higher is better for
 * every item (reps and seconds). */
export function summary(data, items) {
  const tests = testList(data);
  return (items || []).map((item) => {
    const done = tests.filter((t) => t.results[item.key]).map((t) => ({ date: t.date, ...t.results[item.key] }));
    const latest = done[done.length - 1] ?? null;
    if (!latest) return { item, latest: null, previous: null, change: null, best: null };
    const same = done.filter((r) => r.move === latest.move);
    const previous = same.length > 1 ? same[same.length - 2] : null;
    const best = Math.max(...same.map((r) => r.value));
    return { item, latest, previous, change: previous ? latest.value - previous.value : null, best };
  });
}

/** { date, value } points for one item on one move, oldest first (LineChart). */
export function series(data, key, move) {
  return testList(data)
    .filter((t) => t.results[key] && t.results[key].move === move)
    .map((t) => ({ date: t.date, value: t.results[key].value }));
}

/** When the next test is due: 'never' (no test yet), 'due' (today or
 * overdue) or 'later', with the days left (negative when overdue). */
export function nextDue(data, today, everyDays) {
  const tests = testList(data);
  const last = tests[tests.length - 1];
  if (!last) return { status: 'never', days: null, last: null };
  const days = everyDays - daysBetween(last.date, today);
  return { status: days <= 0 ? 'due' : 'later', days, last: last.date };
}

/** A test timer at `now`: a countdown (`seconds` long) or a stopwatch,
 * started at `startedAt` (ms). Whole seconds, so the screen and the saved
 * result agree.
 * @param {{ kind: 'countdown' | 'stopwatch', seconds?: number }} timer */
export function timerAt(timer, startedAt, now) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (timer?.kind === 'countdown') {
    const total = Math.max(0, timer.seconds || 0);
    return { elapsed: Math.min(elapsed, total), left: Math.max(0, total - elapsed), done: elapsed >= total };
  }
  return { elapsed, left: null, done: false };
}

/** 75 -> "1:15" */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
