// Records for one exercise (F-03): the bests behind the Records card on the
// exercise page. Worked out from the logs every time, never stored. Work sets
// only (isWorkSet, F-00), so warm-ups can never set a record. Pure, tested
// in records.test.js.
import { e1rm, E1RM_MAX_REPS, isWorkSet } from './data.js';

const round1 = (n) => Math.round(n * 10) / 10;

/** Every record for this exercise, or null when it has no weighted work set.
 * {
 *   heaviest:   { kg, reps, date }      the most weight lifted for any reps
 *   e1rm:       { kg, from: {kg, reps}, date }  best estimated one-rep max (sets of 12 reps or fewer)
 *   setVolume:  { kg, from: {kg, reps}, date }  best single set, weight x reps
 *   session:    { kg, date }            best total weight x reps in one workout
 *   repMax:     [{ reps: 1..10, actual: {kg, date} | null, estimated: kg | null }]
 * }
 * @param {import('../types').Data} data
 * @param {number} exerciseId */
export function records(data, exerciseId) {
  let heaviest = null;
  let best = null;
  let setVolume = null;
  let session = null;
  const actual = new Map(); // reps -> { kg, date }: heaviest weight done for at least that many reps
  for (const w of data.workouts) {
    let total = 0;
    for (const s of w.sets) {
      if (s.exercise_id !== exerciseId || !isWorkSet(s) || !(s.weight_kg > 0) || !(s.reps > 0)) continue;
      const kg = s.weight_kg;
      total += kg * s.reps;
      if (!heaviest || kg > heaviest.kg || (kg === heaviest.kg && s.reps > heaviest.reps)) heaviest = { kg, reps: s.reps, date: w.log_date };
      if (s.reps <= E1RM_MAX_REPS) {
        const est = e1rm(kg, s.reps);
        if (!best || est > best.kg) best = { kg: round1(est), from: { kg, reps: s.reps }, date: w.log_date };
      }
      const vol = kg * s.reps;
      if (!setVolume || vol > setVolume.kg) setVolume = { kg: round1(vol), from: { kg, reps: s.reps }, date: w.log_date };
      for (let r = 1; r <= Math.min(10, s.reps); r += 1) {
        const cur = actual.get(r);
        if (!cur || kg > cur.kg) actual.set(r, { kg, date: w.log_date });
      }
    }
    if (total > 0 && (!session || total > session.kg)) session = { kg: round1(total), date: w.log_date };
  }
  if (!heaviest) return null;
  const repMax = [];
  for (let r = 1; r <= 10; r += 1) {
    // Epley, solved for the weight at r reps from the best estimate.
    const estimated = best ? round1(r === 1 ? best.kg : best.kg / (1 + r / 30)) : null;
    repMax.push({ reps: r, actual: actual.get(r) || null, estimated });
  }
  return { heaviest, e1rm: best, setVolume, session, repMax };
}
