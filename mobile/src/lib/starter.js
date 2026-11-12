// The starter fortnight (roadmap: "Session 2 of 6"): someone new to
// training sees how far into their first two weeks they are, and the
// how-to opens by itself the first time they meet an exercise. It ends
// after six finished sessions and never shows for anyone who said they
// have trained before.
import { exerciseByName } from './data.js';
import { trainingSettings } from './training.js';

export const STARTER_SESSIONS = 6;
export const HOW_TO_STEPS = 3;

const isBeginner = (data) => trainingSettings(data).level === 'beginner';
const finishedGym = (data) => (data.workouts || []).filter((w) => w.workout_type === 'gym' && w.finished_at).length;

/** { done, total, next } while a beginner is in their first six sessions,
 * else null. `next` is the session they are on or about to start. */
export function starterProgress(data) {
  if (!isBeginner(data)) return null;
  const done = finishedGym(data);
  if (done >= STARTER_SESSIONS) return null;
  return { done, total: STARTER_SESSIONS, next: done + 1 };
}

/** Did finishing this workout complete the starter fortnight? */
export function starterJustDone(data, workoutId) {
  if (!isBeginner(data)) return false;
  const gym = (data.workouts || []).filter((w) => w.workout_type === 'gym' && w.finished_at).sort((a, b) => (a.finished_at < b.finished_at ? -1 : 1));
  return gym.length >= STARTER_SESSIONS && gym[STARTER_SESSIONS - 1].id === workoutId;
}

/** Has a beginner never logged a set of this exercise? Then show how. */
export function showHowTo(data, exerciseName) {
  if (!isBeginner(data)) return false;
  const ex = exerciseByName(data, exerciseName);
  if (!ex) return true;
  return !(data.workouts || []).some((w) => (w.sets || []).some((s) => s.exercise_id === ex.id));
}

/** The first few how-to steps of a catalogue entry, numbering stripped. */
export function howToSteps(entry, max = HOW_TO_STEPS) {
  return (entry?.instructions || []).map((s) => String(s).replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, max);
}
