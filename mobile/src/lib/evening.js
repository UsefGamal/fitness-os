// The optional 8 PM slot: a weekly choice per weekday of an interval
// preset (HIIT, Tabata, EMOM) or recovery, stored as data.evening_plan =
// { monday: 'tabata', ... }. Pure helpers, tested in evening.test.js.
import { weekdayName } from './dates.js';
import { INTERVAL_PRESETS } from './training.js';

export const EVENING_TIME = '20:00';

export const EVENING_OPTIONS = [
  ...INTERVAL_PRESETS.map((p) => ({ key: p.key, label: p.label, note: p.note, route: `/intervals?preset=${p.key}` })),
  { key: 'recovery', label: 'Recovery', note: 'Walk, stretch, breathe', route: '/session/recovery' },
];

export function eveningOption(key) {
  return EVENING_OPTIONS.find((o) => o.key === key) || null;
}

/** The 8 PM session on a date, or null. */
export function eveningOn(data, iso) {
  return eveningOption(data.evening_plan?.[weekdayName(iso)]);
}

export function setEvening(data, weekday, key) {
  const plan = { ...(data.evening_plan || {}) };
  if (key) plan[weekday] = key;
  else delete plan[weekday];
  return { ...data, evening_plan: plan };
}

/** Whether an evening session was logged that day: a cardio or recovery
 * session saved after 18:00, or any matching label. */
export function eveningDone(data, iso, option) {
  if (!option) return false;
  return data.workouts.some((w) => w.log_date === iso && w.workout_type !== 'gym'
    && (w.notes === option.label || (w.finished_at && new Date(w.finished_at).getHours() >= 18)));
}
