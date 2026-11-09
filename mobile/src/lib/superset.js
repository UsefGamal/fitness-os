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
