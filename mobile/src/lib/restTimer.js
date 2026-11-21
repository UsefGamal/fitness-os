// The rest timer's rules that don't need the phone: what the app does with
// the shade timer's state when it comes back to the front, and how the timer
// is kept across the app being closed or killed in the background.

/** How long after a rest ended a reopened app still shows "Rest done". */
export const DONE_GRACE_MS = 60 * 1000;

/**
 * What to change in the app's timer after reading the shade timer.
 * `js` is the app's timer ({ endsAt, total, label, pausedLeft }), `shade` is
 * what RestTimer.state() said ({ endsAt, pausedLeft, label, skipped }):
 * `pausedLeft` > 0 while paused in the shade, `skipped` true when the rest was
 * ended with Skip in the shade.
 * Returns { patch, reshade }: `patch` is the state to set (or null) and
 * `reshade` is true when the app's timer should be put back in the shade.
 *
 * The old rule cleared the app's timer whenever the shade was empty, so a
 * rest that never got into the shade (no notification permission, the
 * permission dialog itself pausing the app, the phone killing the service)
 * vanished when the app came back to the front.
 */
export function syncFromShade(js, shade, now = Date.now()) {
  const shadeEnds = Number(shade?.endsAt) || 0;
  const shadePaused = Number(shade?.pausedLeft) || 0;
  const label = shade?.label || js.label || '';
  // After a restart the app has no total, so the bar would sit empty
  // (QA-15): count the time left as the whole rest.
  const withTotal = (patch, leftMs) => (js.total ? patch : { ...patch, total: Math.ceil(leftMs / 1000) });
  if (shadePaused > 0) {
    return { patch: withTotal({ endsAt: js.endsAt || shadeEnds || now, pausedLeft: shadePaused, label }, shadePaused), reshade: false };
  }
  if (shadeEnds > now) {
    return { patch: withTotal({ endsAt: shadeEnds, pausedLeft: null, label }, shadeEnds - now), reshade: false };
  }
  const on = js.pausedLeft != null || (js.endsAt && js.endsAt > now);
  if (!on) return { patch: null, reshade: false }; // nothing on, or already on "Rest done"
  // Skip in the shade ends the rest here too; anything else means the shade
  // lost it, so the app's timer carries on and goes back there.
  if (shade?.skipped) return { patch: { endsAt: null, pausedLeft: null }, reshade: false };
  return { patch: null, reshade: true };
}

/** The part of the timer worth keeping when the app is closed. */
export function timerToSave({ endsAt, total, label, pausedLeft }) {
  if (!endsAt && pausedLeft == null) return null;
  return { endsAt: endsAt || null, total: total || 0, label: label || '', pausedLeft: pausedLeft ?? null };
}

/**
 * The timer to bring back when the app starts, from what timerToSave kept
 * (a JSON string or null). A rest that ended over a minute ago is dropped.
 */
export function timerToRestore(raw, now = Date.now()) {
  let s;
  try {
    s = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object') return null;
  const total = Number.isFinite(s.total) && s.total > 0 ? s.total : 0;
  const label = typeof s.label === 'string' ? s.label.slice(0, 200) : '';
  if (Number.isFinite(s.pausedLeft) && s.pausedLeft > 0) {
    // Paused: the time left doesn't run down while the app is away.
    return { endsAt: Number.isFinite(s.endsAt) ? s.endsAt : now, total, label, pausedLeft: s.pausedLeft };
  }
  if (!Number.isFinite(s.endsAt) || s.endsAt <= now - DONE_GRACE_MS) return null;
  return { endsAt: s.endsAt, total, label, pausedLeft: null };
}

/**
 * The two text lines the notification shows under the exercise name:
 * `detail` is the next set ("Set 3 of 4 · 60 kg × 8", or "Set 1 of 3 · 8-10
 * reps" when the load isn't known yet) and `progress` the workout so far
 * ("Lower A · 7/18 sets"). Empty parts are left out. Before the first set
 * of a barbell lift, `warmup` puts the warm-up ramp first ("Warm up: 20 kg ×
 * 8, 40 × 5 · Set 1 of 3 · 60 kg × 8").
 * @param {{ setNo?: number, setsPlanned?: number, weightKg?: number, reps?: number, targetReps?: string | number, workout?: string, done?: number, planned?: number, warmup?: { kg: number, reps: number }[] }} [next]
 */
export function shadeLines({ setNo, setsPlanned, weightKg, reps, targetReps, workout, done, planned, warmup } = {}) {
  const parts = [];
  if (Array.isArray(warmup) && warmup.length) {
    parts.push(`Warm up: ${warmup.slice(0, 4).map((w, i) => `${+Number(w.kg).toFixed(2)}${i ? '' : ' kg'} × ${w.reps}`).join(', ')}`);
  }
  if (setNo > 0) parts.push(setsPlanned > 0 ? `Set ${Math.min(setNo, 99)} of ${setsPlanned}` : `Set ${Math.min(setNo, 99)}`);
  if (weightKg > 0 && reps > 0) parts.push(`${+Number(weightKg).toFixed(2)} kg × ${reps}`);
  else if (reps > 0) parts.push(`${reps} reps`);
  else if (targetReps) parts.push(`${String(targetReps).slice(0, 12)} reps`);
  const prog = [];
  if (workout) prog.push(String(workout).slice(0, 60));
  if (planned > 0) prog.push(`${Math.max(0, done || 0)}/${planned} sets`);
  return { detail: parts.join(' · '), progress: prog.join(' · ') };
}

/** The most sets one exercise offers to "Log set & rest" from the shade. */
export const SHADE_LOG_MAX = 10;

/**
 * The sets the "Rest done" notification can log with "Log set & rest", in
 * order: the rest of this exercise's planned sets at the load and reps just
 * lifted. Each entry is { set, detail, progress }: `set` is what gets logged
 * ({ w: workout id, e: exercise id, n: its set_number, r: reps, kg, s:
 * seconds for a timed hold or null }) and `detail`/`progress` the lines the
 * shade shows while that set is the next one. Empty when nothing is left
 * to log, or the reps or a needed weight aren't known.
 * @param {{ workoutId: number, exerciseId: number, logged: number, workDone: number, setsPlanned: number, reps: number, weightKg?: number, timed?: boolean, workout?: string, done?: number, planned?: number }} p
 */
export function shadeLogChain({ workoutId, exerciseId, logged, workDone, setsPlanned, reps, weightKg = 0, timed = false, workout = '', done = 0, planned = 0 }) {
  if (!(workoutId > 0) || !(exerciseId > 0) || !(reps >= 1) || !(setsPlanned > 0)) return [];
  const kg = Number(weightKg) > 0 ? Number(weightKg) : 0;
  const out = [];
  for (let i = 0; workDone + i < setsPlanned && i < SHADE_LOG_MAX; i += 1) {
    const lines = shadeLines({ setNo: workDone + i + 1, setsPlanned, ...(timed ? {} : { weightKg: kg, reps }), workout, done: done + i, planned });
    if (timed) lines.detail += ` · ${Math.round(reps)}s`;
    // `head` lets the shade rewrite the line when the weight is changed there.
    const head = `Set ${Math.min(workDone + i + 1, 99)} of ${setsPlanned}`;
    out.push({ head, timed, set: { w: workoutId, e: exerciseId, n: logged + i + 1, r: Math.round(reps), kg: timed ? 0 : kg, s: timed ? Math.round(reps) : null }, ...lines });
  }
  return out;
}

/**
 * The sets to add for what was logged from the shade, in order, as addSet
 * arguments with the workout id. A set is only taken while its workout is
 * still under way and it is the very next set of its exercise (n is one past
 * the sets already there), so a log that arrives twice, or after the set
 * was logged in the app, is dropped.
 * @param {{ workouts?: { id: number, finished_at?: number | null, sets?: { exercise_id: number }[] }[] }} data
 * @param {unknown} logs
 * @returns {{ workoutId: number, exerciseId: number, reps: number, weightKg: number, seconds: number | null }[]}
 */
export function shadeLogsToAdd(data, logs) {
  if (!Array.isArray(logs)) return [];
  const count = new Map(); // `${w}:${e}` -> sets so far, counting the ones taken here
  const out = [];
  for (const raw of logs.slice(0, 50)) {
    let l = raw;
    if (typeof l === 'string') {
      try {
        l = JSON.parse(l);
      } catch {
        continue;
      }
    }
    if (!l || typeof l !== 'object') continue;
    const { w, e, n, r, kg, s } = /** @type {Record<string, unknown>} */ (l);
    if (![w, e, n, r].every((v) => Number.isInteger(v) && Number(v) > 0) || Number(r) > 1000) continue;
    const wk = (data?.workouts || []).find((x) => x.id === w && !x.finished_at);
    if (!wk) continue;
    const key = `${w}:${e}`;
    const have = count.has(key) ? count.get(key) : (wk.sets || []).filter((x) => x.exercise_id === e).length;
    if (n !== have + 1) continue;
    count.set(key, have + 1);
    const weightKg = Number.isFinite(kg) && Number(kg) >= 0 ? Math.min(Number(kg), 1000) : 0;
    const seconds = Number.isInteger(s) && Number(s) > 0 ? Math.min(Number(s), 3600) : null;
    out.push({ workoutId: /** @type {number} */ (w), exerciseId: /** @type {number} */ (e), reps: seconds ?? /** @type {number} */ (r), weightKg, seconds });
  }
  return out;
}

/**
 * The exercise photo the notification may show: a bundled file under
 * exercise-db/ (catalogue photoSrc), else ''. Anything else (a web address,
 * a path going up a folder) is dropped, since the phone reads it from the
 * app's own files.
 * @param {unknown} path
 */
export function shadePhoto(path) {
  if (typeof path !== 'string' || path.length > 200) return '';
  if (!/^exercise-db\/[A-Za-z0-9_\-./]+\.(jpe?g|png|webp)$/i.test(path) || path.includes('..') || path.includes('//')) return '';
  return path;
}
