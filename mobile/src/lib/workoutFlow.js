// The workout's own flow (design laws plan #6, #7). Pure helpers, tested in
// workoutFlow.test.js.

/** Home's Start: 'go' starts the session straight away; 'preview' keeps
 * the page first when it has something to read before starting (a recovery
 * week, a safety change, equipment swaps, a session already done today). */
export function startMode({ notes }) {
  return notes ? 'preview' : 'go';
}

/** The bar at the bottom of a running workout, in thumb reach: 'log' the
 * next planned set, 'finish' once every planned set is in, or nothing while
 * the rest timer or the finish sheet already holds the bottom. */
export function logBarMode({ resting, finishing, done, target, canLog }) {
  if (resting || finishing) return null;
  if (target > 0 && done >= target) return 'finish';
  return canLog ? 'log' : null;
}

/** The effort chips on the finish sheet, on the 1-10 scale saved as
 * session_rpe. '' is Skip. */
export const EFFORT = [
  { value: '', key: 'finish.effortSkip' },
  { value: '4', key: 'finish.effortEasy' },
  { value: '6', key: 'finish.effortOk' },
  { value: '8', key: 'finish.effortHard' },
  { value: '10', key: 'finish.effortMax' },
];
