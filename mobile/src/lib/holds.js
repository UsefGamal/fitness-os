// Which moves are held for time (a plank, a wall sit) rather than counted
// in reps. The plan marks a hold by its reps ("30-45s", lib/progression.js
// holdRange); this file gives a move its seconds when it is swapped or
// added into a slot that was written for reps, so the Workout screen logs
// seconds for it (#155) and not "8 reps at 0 kg". Pure; holds.test.js.
import { holdRange } from './progression.js';

/** Names of moves that are held, not repeated. Moves with "taps", "jacks"
 * or "walk" in the name move, so they are counted (Plank Jacks). */
const HOLD_NAME = /\b(plank|wall sit|hollow (?:body )?hold|dead hang|l-sit|hold)\b/i;
const MOVING = /\b(taps?|jacks?|walks?|ups?|to push-up|rows?|reach(?:es)?|drags?)\b/i;

/** The reps a hold starts at when nothing better is known. */
export const DEFAULT_HOLD_REPS = '30-45s';
/** The reps a lift gets when it replaces a hold. */
export const DEFAULT_LIFT_REPS = '8-12';

/** Is this move held for time? */
export function isHoldName(name) {
  const n = String(name || '');
  return HOLD_NAME.test(n) && !MOVING.test(n);
}

/** The reps to keep when `name` takes over a slot whose reps were `oldReps`:
 * a hold put where a lift was gets seconds, a lift put where a hold was
 * gets a rep range; otherwise the slot's own reps stay. */
export function repsForSwap(oldReps, name) {
  const wasHold = Boolean(holdRange(oldReps));
  const hold = isHoldName(name);
  if (hold && !wasHold) return DEFAULT_HOLD_REPS;
  if (!hold && wasHold) return DEFAULT_LIFT_REPS;
  return oldReps;
}
