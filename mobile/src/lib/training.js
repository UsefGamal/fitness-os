// Training settings and timer rules: default rest, workout length, paused
// time, and the step list behind interval mode. Pure helpers, tested in
// training.test.js.

export const REST_CHOICES = [45, 60, 75, 90, 120, 150, 180, 240];
export const TARGET_CHOICES = [0, 45, 60, 75, 90];
export const VOLUMES = { low: 0.25, medium: 0.55, high: 1 };
export const SOUND_SETS = { classic: 'Classic bell', soft: 'Soft' };

export function defaultTraining() {
  return {
    rest_compound: 120, // big lifts, when the plan doesn't say
    rest_isolation: 75, // small lifts
    auto_rest: true, // start the rest timer when a set is logged
    sounds: true,
    volume: 'medium',
    sound_set: 'classic',
    reward_sounds: 'gentle', // lib/rewards.js REWARD_LEVELS: ticks for sets, meals and water
    vibrate: true,
    target_min: 0, // 0 = no target workout length
    bar: 'olympic', // lib/plates.js BARS
    plates: [25, 20, 15, 10, 5, 2.5, 1.25], // sizes you own, kg
    level: null, // lib/levels.js LEVELS; null = not chosen, so nothing is labelled
  };
}

/** The training settings with defaults filled in (older data has none). */
export function trainingSettings(data) {
  return { ...defaultTraining(), ...(data?.settings?.training || {}) };
}

export function setTraining(data, changes) {
  return { ...data, settings: { ...data.settings, training: { ...trainingSettings(data), ...changes } } };
}

/** Rest in seconds before the next set: a one-off override for this
 * session, else the plan's rest, else the default for a big or small lift.
 * `mechanic` comes from the catalogue ('compound' | 'isolation' | null). */
export function restFor(ex, settings, { mechanic = null, override = undefined } = {}) {
  if (override !== undefined) return override; // 0 means no timer
  if (ex?.rest_sec) return ex.rest_sec;
  return mechanic === 'isolation' ? settings.rest_isolation : settings.rest_compound;
}

/** "1:30", "0:05", "12:00". */
export function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Workout time so far in ms, not counting pauses. */
export function activeMs(workout, now) {
  if (workout?.started_at == null) return 0;
  const pausedNow = workout.paused_at ? now - workout.paused_at : 0;
  return Math.max(0, now - workout.started_at - (workout.paused_ms || 0) - pausedNow);
}

export function pauseWorkout(data, id, now = Date.now()) {
  return mapWorkout(data, id, (w) => (w.paused_at ? w : { ...w, paused_at: now }));
}

export function resumeWorkout(data, id, now = Date.now()) {
  return mapWorkout(data, id, (w) => (w.paused_at ? { ...w, paused_ms: (w.paused_ms || 0) + (now - w.paused_at), paused_at: null } : w));
}

function mapWorkout(data, id, fn) {
  return { ...data, workouts: data.workouts.map((w) => (w.id === id ? fn(w) : w)) };
}

/** Put a deleted set back where it was (Undo). */
export function restoreSet(data, workoutId, set) {
  return mapWorkout(data, workoutId, (w) => {
    const sets = [...w.sets, set].sort((a, b) => a.id - b.id);
    let n = 0;
    return { ...w, sets: sets.map((s) => (s.exercise_id === set.exercise_id ? { ...s, set_number: (n += 1) } : s)) };
  });
}

/** Progress toward the target length: { fraction 0..1+, over: bool } or null. */
export function targetProgress(ms, targetMin) {
  if (!targetMin) return null;
  const fraction = ms / (targetMin * 60000);
  return { fraction, over: fraction >= 1 };
}

// ── Interval mode ─────────────────────────────────────────────────────

export const INTERVAL_PRESETS = [
  { key: 'hiit', label: 'HIIT 30/30', note: '30 s hard, 30 s easy, 10 rounds', work: 30, rest: 30, rounds: 10, sets: 1, setRest: 0, warmup: 60, cooldown: 60 },
  { key: 'tabata', label: 'Tabata', note: '20 s all out, 10 s rest, 8 rounds', work: 20, rest: 10, rounds: 8, sets: 1, setRest: 0, warmup: 60, cooldown: 60 },
  { key: 'emom', label: 'EMOM 10 min', note: 'Start a set every minute for 10 minutes', work: 60, rest: 0, rounds: 10, sets: 1, setRest: 0, warmup: 0, cooldown: 0 },
  { key: 'hiit45', label: 'HIIT 45/15', note: '45 s on, 15 s off, 3 sets of 6, 1 min between', work: 45, rest: 15, rounds: 6, sets: 3, setRest: 60, warmup: 60, cooldown: 60 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

/** Clean up a custom interval form into safe numbers. */
export function normalizeIntervals(c) {
  return {
    ...c,
    work: clamp(c.work, 5, 600),
    rest: clamp(c.rest, 0, 600),
    rounds: clamp(c.rounds, 1, 50),
    sets: clamp(c.sets ?? 1, 1, 10),
    setRest: clamp(c.setRest ?? 0, 0, 600),
    warmup: clamp(c.warmup ?? 0, 0, 600),
    cooldown: clamp(c.cooldown ?? 0, 0, 600),
  };
}

/** The steps an interval session runs through, in order:
 * [{ kind: 'warmup'|'work'|'rest'|'setrest'|'cooldown', seconds, round, set }].
 * No rest after the last round of a set; no set rest after the last set. */
export function intervalSteps(config) {
  const c = normalizeIntervals(config);
  const steps = [];
  if (c.warmup) steps.push({ kind: 'warmup', seconds: c.warmup, round: 0, set: 0 });
  for (let set = 1; set <= c.sets; set += 1) {
    for (let round = 1; round <= c.rounds; round += 1) {
      steps.push({ kind: 'work', seconds: c.work, round, set });
      if (c.rest && round < c.rounds) steps.push({ kind: 'rest', seconds: c.rest, round, set });
    }
    if (c.setRest && set < c.sets) steps.push({ kind: 'setrest', seconds: c.setRest, round: c.rounds, set });
  }
  if (c.cooldown) steps.push({ kind: 'cooldown', seconds: c.cooldown, round: c.rounds, set: c.sets });
  return steps;
}

export function totalSeconds(steps) {
  return steps.reduce((n, s) => n + s.seconds, 0);
}

/** Where a session is after `elapsed` seconds: { index, left } or { done: true }. */
export function stepAt(steps, elapsed) {
  let t = elapsed;
  for (let i = 0; i < steps.length; i += 1) {
    if (t < steps[i].seconds) return { index: i, left: steps[i].seconds - t };
    t -= steps[i].seconds;
  }
  return { done: true };
}

/** Whole seconds left at which a countdown beep plays. */
export const COUNTDOWN_BEEPS = [3, 2, 1];
