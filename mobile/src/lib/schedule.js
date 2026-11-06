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
      tile: key === 'rest' ? 'Rest' : tileLabel(programDay(key, training).label),
      isToday: date === iso,
    };
  });
}

/** A session name short enough for a week-strip tile (about 37px wide on
 * a 360px phone), so variants stay apart: 'Full body A' -> 'FB A',
 * 'Upper B' -> 'Up B', 'Lower A (Home)' -> 'Lo A', 'Push' -> 'Push'. Never
 * ends in an ellipsis; the full name is in the tile's label and the sheet. */
export function tileLabel(label) {
  const clean = String(label || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (clean.length <= 5) return clean;
  const words = clean.split(/\s+/).filter((w) => !/^(&|and|\+|-)$/i.test(w));
  const last = words[words.length - 1];
  const variant = words.length > 1 && /^([A-Z]|\d{1,2})$/i.test(last) ? last.toUpperCase() : null;
  const base = variant ? words.slice(0, -1) : words;
  const short = base.length > 1
    ? base.slice(0, 3).map((w) => w[0].toUpperCase()).join('')
    : variant ? base[0].slice(0, 2) : base[0].slice(0, 5);
  return variant ? `${short} ${variant}` : short;
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
  // A session picked for one day (from: null) leaves that day empty when it moves on.
  if (original && original.from == null) {
    const planned = sessionKeyOn(from, training, []);
    const emptied = planned === 'rest' ? [] : [{ from: null, to: from, key: 'rest' }];
    return { ...data, session_moves: [...keep, ...emptied, { from: null, to, key }] };
  }
  const next = original ? { from: original.from, to, key } : { from, to, key };
  return { ...data, session_moves: next.from === next.to ? keep : [...keep, next] };
}

/** Do `key` (a session key or 'rest') on `iso` instead of what's on, for
 * that day only. A session moved onto `iso` from another day keeps that
 * day empty. Picking what the weekly plan has drops the change. */
export function setSessionOn(data, training, iso, key) {
  const moves = data.session_moves || [];
  if (sessionKeyOn(iso, training, moves) === key) return data;
  const existing = moves.find((m) => m.to === iso);
  const keep = moves.filter((m) => m.to !== iso && m.to >= addDays(iso, -14));
  const from = existing?.from ?? null;
  if (from == null && sessionKeyOn(iso, training, keep) === key) return { ...data, session_moves: keep };
  return { ...data, session_moves: [...keep, { from, to: iso, key }] };
}

/** True when `iso` shows something other than the weekly plan. */
export function isChangedOn(iso, moves = []) {
  return moves.some((m) => m.to === iso);
}

/** Put a moved session back on its planned day. */
export function undoMove(data, to) {
  return { ...data, session_moves: (data.session_moves || []).filter((m) => m.to !== to) };
}

/** Days from `from` through the next 7 that have no session: where it can go. */
export function moveTargets(from, training, moves = []) {
  return Array.from({ length: 8 }, (_, i) => addDays(from, i)).filter((d) => d !== from && sessionKeyOn(d, training, moves) === 'rest');
}
