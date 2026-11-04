// What's planned on a given day. Mirrors content/gym_program.py
// (session_key_on, program_day_for, week_view); schedule.test.js keeps the
// same cases as tests/test_gym_program.py, so change both together.
import { addDays, shortWeekday, weekStart, weekdayName } from './dates.js';

export function sessionKeyOn(iso, training) {
  const entry = training.trainer_plan.schedule.find((d) => d.day === weekdayName(iso));
  return entry ? entry.session : 'rest';
}

export function programDay(key, training) {
  return training.program.find((d) => d.key === key) || null;
}

/** The session on `iso`. On a rest day, the next session with isRestToday
 * and the date it falls on, so "what's next" always has an answer. */
export function programDayFor(iso, training) {
  const key = sessionKeyOn(iso, training);
  if (key !== 'rest') return { ...programDay(key, training), isRestToday: false, onDate: iso };
  for (let i = 1; i < 8; i += 1) {
    const later = addDays(iso, i);
    const laterKey = sessionKeyOn(later, training);
    if (laterKey !== 'rest') return { ...programDay(laterKey, training), isRestToday: true, onDate: later };
  }
  throw new Error('The schedule has no training day');
}

export function weekView(iso, training) {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = sessionKeyOn(date, training);
    return {
      date,
      short: shortWeekday(date),
      key,
      label: key === 'rest' ? 'Rest' : programDay(key, training).label,
      isToday: date === iso,
    };
  });
}

/** '2m' -> 120, '1.5-2m' -> 90, '45s per arm' -> 45. Same as rest_seconds(). */
export function restSeconds(rest) {
  if (!rest) return null;
  const m = /^\s*(\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)?\s*([ms])/.exec(rest);
  if (!m) return null;
  const v = Number(m[1]);
  return m[2] === 'm' ? Math.round(v * 60) : Math.round(v);
}
