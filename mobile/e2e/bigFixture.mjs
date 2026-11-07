// A 3-year data file (P14-17): Yusuf's fixture plus three years of history
// ending on the harness's day, so Home's speed can be checked on a phone
// that has used the app for a long time. Deterministic: no randomness.
import { readFileSync } from 'node:fs';

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

export function bigFixture(end = '2026-11-06', years = 3) {
  const base = JSON.parse(readFileSync(new URL('../src/lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
  const last = Date.parse(`${end}T00:00:00Z`);
  const first = last - years * 365 * DAY;
  const exIds = base.exercises.slice(0, 8).map((e) => e.id);
  const workouts = [];
  const body = [];
  const meals = [];
  const water = [];
  let setId = 1;
  for (let t = first, n = 0; t <= last; t += DAY, n += 1) {
    const date = iso(t);
    const dow = new Date(t).getUTCDay();
    if (dow !== 5) {
      const sets = [];
      for (let e = 0; e < 6; e += 1) {
        for (let s = 1; s <= 3; s += 1) {
          sets.push({ id: setId++, exercise_id: exIds[(n + e) % exIds.length], set_number: s, reps: 8 + (s % 3), weight_kg: 40 + ((n + e * 7) % 40), rpe: 8, rir: 2, is_warmup: false });
        }
      }
      workouts.push({ id: workouts.length + 1, log_date: date, workout_type: 'gym', duration_min: 60, notes: null, session_rpe: 8, is_deload: false, pain_note: null, result: null, session_key: ['upper', 'lower', 'push', 'pull', 'legs'][n % 5], started_at: t + 4 * 3600000, finished_at: t + 5 * 3600000, sets });
    }
    if (dow === 0) body.push({ id: body.length + 1, log_date: date, weight_kg: Math.round((110 - n * 0.01) * 10) / 10, waist_cm: null, notes: null, sleep_hours: null, chest_cm: null, arm_cm: null, hips_cm: null, thigh_cm: null });
    for (const slot of ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner']) meals.push({ id: meals.length + 1, log_date: date, meal_slot: slot, completed: true, option_key: n % 2 ? 'option_b' : 'option_a', drink_key: null });
    water.push({ id: water.length + 1, log_date: date, ml: 2500 });
  }
  return { ...base, workouts, body_logs: body, meal_logs: meals, hydration_logs: water, session_moves: [] };
}
