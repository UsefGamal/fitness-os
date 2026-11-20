// Supersets (F-01a): paired exercises (plan rows with the same `pair`
// letter, "A" with "A") rest only after the whole round, not after each
// set. Pure helpers, tested in superset.test.js; views/Workout.jsx uses them.

/** Indexes of the exercises paired with exercise `i` (itself included), or
 * just [i] when it isn't paired. */
export function groupOf(exercises, i) {
  const letter = exercises[i]?.pair?.[0];
  if (!letter) return [i];
  return exercises.map((x, j) => (x.pair?.[0] === letter ? j : -1)).filter((j) => j >= 0);
}

/** After a set of exercise `i` is logged (`done[j]` = sets done so far,
 * this one included), is the round over? It is when no partner still owes
 * a set for this round: each has done as many sets as `i` has, or all of
 * its own. A lone exercise always ends its round. */
export function roundDone(exercises, done, i) {
  const n = done[i] || 0;
  return groupOf(exercises, i).every((j) => j === i || (done[j] || 0) >= Math.min(n, exercises[j].sets));
}

/** The rest after a round: the longest rest in the group, so the slowest
 * lift is ready (the coach's rule: the longest, never the sum).
 * `restOf(j)` gives each exercise's own rest in seconds. */
export function roundRest(exercises, i, restOf) {
  return Math.max(0, ...groupOf(exercises, i).map((j) => restOf(j) || 0));
}

// ── Making your own supersets ─────────────────────────────────────────
// A plan list (or today's workout) links two neighbours with one letter.
// Both editors (Plan > Edit, My routine) and the workout's More sheet use
// these, so a pair is stored the same way as the built-in plan's pairs.

export const PAIR_LETTERS = 'ABCDEFGH';

function single(e) {
  const { pair, ...rest } = e;
  return rest.type === 'paired' ? { ...rest, type: 'normal' } : rest;
}

/** `list` with exercise `i` out of its superset. A partner left on its
 * own is no longer a superset either. Returns `list` when `i` isn't paired. */
export function unpair(list, i) {
  const letter = list[i]?.pair?.[0];
  if (!letter) return list;
  let out = list.map((e, j) => (j === i ? single(e) : e));
  if (out.filter((e) => e.pair?.[0] === letter).length === 1) out = out.map((e) => (e.pair?.[0] === letter ? single(e) : e));
  return out;
}

/** `list` with exercise `i` and the one after it done as a superset. When
 * `i` is already in one, the next exercise joins it (a tri-set); the next
 * one leaves any superset it was in. Returns `list` when there is no next
 * exercise, they are already together, or all eight letters are taken. */
export function pairWithNext(list, i) {
  if (i < 0 || i + 1 >= list.length) return list;
  const a = list[i]?.pair?.[0];
  if (a && list[i + 1].pair?.[0] === a) return list;
  const out = unpair(list, i + 1);
  const used = new Set(out.map((e) => e.pair?.[0]).filter(Boolean));
  const letter = out[i].pair?.[0] || [...PAIR_LETTERS].find((l) => !used.has(l));
  if (!letter) return list;
  return out.map((e, j) => (j === i || j === i + 1 ? { ...e, pair: letter, type: 'paired' } : e));
}

/** Is exercise `i` in a superset with the exercise after it? */
export function pairedWithNext(list, i) {
  const a = list[i]?.pair?.[0];
  return Boolean(a) && list[i + 1]?.pair?.[0] === a;
}
