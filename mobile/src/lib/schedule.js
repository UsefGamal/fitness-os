// What's planned on a given day. Mirrors content/gym_program.py
// (session_key_on, program_day_for, week_view); schedule.test.js keeps the
// same cases as tests/test_gym_program.py, so change both together.
import { addDays, shortWeekday, weekStart, weekdayName } from './dates.js';

/** The session on `iso`. `moves` ([{ from, to, key }], data.session_moves)
 * shift a session to another day without touching the weekly plan. */
export function sessionKeyOn(iso, training, moves = []) {
  const moved = moves.find((m) => m.to === iso);
  if (moved) return moved.key;
  if (moves.some((m) => m.from === iso)) return 'rest';
  const entry = training.trainer_plan.schedule.find((d) => d.day === weekdayName(iso));
  return entry ? entry.session : 'rest';
}

export function programDay(key, training) {
  return training.program.find((d) => d.key === key) || null;
}

/** The session on `iso`. On a rest day, the next session with isRestToday
 * and the date it falls on, so "what's next" always has an answer. */
export function programDayFor(iso, training, moves = []) {
  const key = sessionKeyOn(iso, training, moves);
  if (key !== 'rest') return { ...programDay(key, training), isRestToday: false, onDate: iso };
  for (let i = 1; i < 8; i += 1) {
    const later = addDays(iso, i);
    const laterKey = sessionKeyOn(later, training, moves);
    if (laterKey !== 'rest') return { ...programDay(laterKey, training), isRestToday: true, onDate: later };
  }
  throw new Error('The schedule has no training day');
}

export function weekView(iso, training, moves = []) {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = sessionKeyOn(date, training, moves);
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

// ── Moving a session ───────────────────────────────────────────────────

/** Move the session planned on `from` to `to` (a rest day). Moves older
 * than two weeks are dropped so the list stays short. */
export function moveSession(data, training, from, to) {
  const moves = data.session_moves || [];
  const key = sessionKeyOn(from, training, moves);
  if (key === 'rest' || from === to) return data;
  const keep = moves.filter((m) => m.to !== from && m.from !== from && m.to !== to && m.to >= addDays(from, -14));
  const original = moves.find((m) => m.to === from);
  const next = original ? { from: original.from, to, key } : { from, to, key };
  return { ...data, session_moves: next.from === next.to ? keep : [...keep, next] };
}

/** Put a moved session back on its planned day. */
export function undoMove(data, to) {
  return { ...data, session_moves: (data.session_moves || []).filter((m) => m.to !== to) };
}

/** Days from `from` through the next 7 that have no session: where it can go. */
export function moveTargets(from, training, moves = []) {
  return Array.from({ length: 8 }, (_, i) => addDays(from, i)).filter((d) => d !== from && sessionKeyOn(d, training, moves) === 'rest');
}
