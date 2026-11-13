// An easy way back after a gap (BACK-1). The biggest quit point is coming
// back: so a returning person gets a welcome, no lapsed streak, and a
// lighter first session instead of last month's loads. Pure; comeback.test.js.
import { daysBetween } from './dates.js';
import { repRange } from './progression.js';

/** The gap (days since the last workout) where each level starts.
 * @type {[number, string][]} */
export const LEVELS = [
  [63, 'fresh'], // 8+ weeks: start fresh, no prefilled weight
  [28, 'easy80'], // 4 to 8 weeks: 80% of last time
  [14, 'easy90'], // 2 to 3 weeks: 90%
  [4, 'short'], // a few days: last time's weights, nothing added
];
const SHARE = { easy90: 0.9, easy80: 0.8 };

/** Days since the last workout, any type. A workout still running doesn't
 * count, so the gap holds until the first session back is finished. null
 * when there has never been one (a new person is not "back"). */
export function awayDays(data, today) {
  let last = null;
  for (const w of data?.workouts || []) {
    if (w.log_date > today) continue;
    const running = (w.workout_type || 'gym') === 'gym' && !w.finished_at;
    if (running) continue;
    if (!last || w.log_date > last) last = w.log_date;
  }
  return last ? daysBetween(last, today) : null;
}

/** null, or { days, level } with level 'short' | 'easy90' | 'easy80' | 'fresh'. */
export function comeback(data, today) {
  const days = awayDays(data, today);
  if (days == null) return null;
  for (const [from, level] of LEVELS) if (days >= from) return { days, level };
  return null;
}

/** Show the welcome-back card today? Not once hidden for the day. */
export function showBack(data, today) {
  return Boolean(comeback(data, today)) && data?.settings?.back_seen !== today;
}

export function hideBack(data, today) {
  return { ...data, settings: { ...data.settings, back_seen: today } };
}

const roundTo = (kg, step) => Math.round(kg / step) * step;
const kgOf = (s) => s.weight_kg || 0;

/** The first session back: the usual progression target (lib/progression.js)
 * made gentler for the gap. `sessions` are the same earlier work sets
 * progressionTarget saw, newest first.
 * @param {any} target
 * @param {string | null | undefined} level
 * @param {{ planReps?: string, sessions?: any[][], step?: number }} [opts] */
export function comebackTarget(target, level, { planReps, sessions = [], step = 2.5 } = {}) {
  if (!level || !target) return target;
  const range = repRange(planReps);
  const lo = range ? range[0] : target.reps;
  const last = sessions[0];
  if (level === 'fresh') {
    return { weightKg: null, reps: lo, kind: 'fresh', reason: `Welcome back: pick a weight you could lift 3 more times${lo ? ` for ${lo} reps` : ''}.` };
  }
  if (!last?.length) return target; // never done: the usual first-time advice
  const top = Math.max(...last.map(kgOf));
  if (level === 'short') {
    if (target.kind !== 'add') return target;
    const hi = range ? range[1] : target.reps;
    return { weightKg: top, reps: hi, kind: 'repeat', reason: `Welcome back: same weight as last time, ${top} kg.` };
  }
  const share = SHARE[level];
  if (!share || top <= 0) return { ...target, kind: target.kind === 'add' ? 'repeat' : target.kind, weightKg: target.kind === 'add' ? top : target.weightKg };
  const kg = Math.max(0, Math.round(roundTo(top * share, step) * 100) / 100);
  return { weightKg: kg, reps: lo, kind: 'easy', reason: `Welcome back: ${kg} kg today, a little lighter than last time.` };
}

// ── "Still time today?" ───────────────────────────────────────────────

/** Minutes past the session time before Home asks. */
export const STILL_AFTER_MIN = 120;

const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Should the session card ask "Still time today?" `nowMinutes` is the
 * time of day in minutes; `sessionTime` "07:00"; `scheduled` today's
 * session key ('rest' on a rest day); `moveTo` the first free day ahead or
 * null (lib/schedule.js moveTargets). Returns null or { moveTo }. Never in
 * a recovery week or while the welcome-back card is due. */
export function stillTime({ data, today, nowMinutes, sessionTime, scheduled, recovery = false, moveTo = null }) {
  if (!scheduled || scheduled === 'rest' || recovery) return null;
  if (data?.settings?.still_skip === today) return null;
  if (comeback(data, today)) return null;
  if ((data?.workouts || []).some((w) => w.log_date === today && (w.workout_type || 'gym') === 'gym')) return null;
  const at = minutesOf(sessionTime);
  if (at == null || nowMinutes - at <= STILL_AFTER_MIN) return null;
  return { moveTo };
}

/** "Skip today": the question goes away for today. Nothing else is kept. */
export function skipToday(data, today) {
  return { ...data, settings: { ...data.settings, still_skip: today } };
}
