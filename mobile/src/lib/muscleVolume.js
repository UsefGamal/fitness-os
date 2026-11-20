// Stats > Muscles (charts step 4, BI-17 + DV-17): one window for muscle
// volume. Hard sets a week per body-map group, averaged over the last four
// completed weeks, against the 10-20 guide; this week shows as "so far".
// A set counts 1 for each of its main groups and 0.5 for helper groups,
// once per group (a pull-up is one back set, not lats + middle back).
// Stretches count for nothing. Sessions without sets (intervals, home,
// cardio, padel) add light sets through sessionLoad.js.
// Recovery weeks (any deload session) are left out of the average.
import { hardSetValue } from './data.js';
import { addDays, weekStart } from './dates.js';
import { GROUPS16, groupsOfTarget, trainedGroups } from './muscleGroups.js';
import { sessionLoads } from './sessionLoad.js';
import { band, GUIDE, HELPER_SHARE } from './weeklySets.js';

export const AVG_WEEKS = 4;

/**
 * { ready, weeks, skipped, groups: { key: { avg, soFar, band } }, unknown }
 * weeks = completed weeks averaged; skipped = recovery weeks left out.
 * ready is false until one completed week exists since the first workout.
 * @param {import('../types').Data} data @param {any} training @param {string} today
 * @param {(name: string) => any} [entryOf] */
export function muscleVolume(data, training, today, entryOf = () => null, n = AVG_WEEKS) {
  const thisWeek = weekStart(today, data);
  const keys = Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (i + 1)));
  const from = keys[keys.length - 1];
  const byId = new Map(data.exercises.map((e) => [e.id, e]));
  const seen = new Map();
  // BeFit's trainedGroups: a stretch trains no group, so it is neither
  // counted nor "unknown". null = a move with no known muscle.
  const groupsFor = (id) => {
    if (!seen.has(id)) {
      const ex = byId.get(id);
      const entry = ex ? entryOf(ex.name) : null;
      const g = ex ? trainedGroups(ex, training, entry) : null;
      const stretch = entry?.category === 'stretching' && !training?.exercise_targets?.[ex?.name];
      seen.set(id, g && (g.main.length || stretch) ? g : null);
    }
    return seen.get(id);
  };
  /** @type {Map<string, Record<string, number>>} */
  const weeks = new Map();
  for (const k of [thisWeek, ...keys]) weeks.set(k, {});
  const deload = new Set();
  let unknown = 0;
  let firstDate = null;
  for (const w of data.workouts) {
    if (w.log_date > today) continue;
    if (!firstDate || w.log_date < firstDate) firstDate = w.log_date;
    if (w.log_date < from) continue;
    const wk = weekStart(w.log_date, data);
    const bucket = weeks.get(wk);
    if (!bucket) continue;
    if (w.is_deload) deload.add(wk);
    for (const s of w.sets || []) {
      const v = hardSetValue(s);
      if (!v) continue;
      const g = groupsFor(s.exercise_id);
      if (!g) { if (wk !== thisWeek) unknown += 1; continue; }
      for (const k of g.main) bucket[k] = (bucket[k] || 0) + v;
      for (const k of g.helpers) bucket[k] = (bucket[k] || 0) + v * HELPER_SHARE;
    }
    // Interval rounds, a ticked home workout, cardio and padel (light sets).
    for (const l of sessionLoads(w, training, entryOf)) {
      const g = groupsOfTarget(l.target);
      for (const k of g.main) bucket[k] = (bucket[k] || 0) + l.sets;
      for (const k of g.helpers) bucket[k] = (bucket[k] || 0) + l.sets * HELPER_SHARE;
    }
  }
  // Only weeks since the person started count, so a new user isn't
  // averaged against empty weeks before their first workout.
  const started = firstDate ? weekStart(firstDate, data) : null;
  const used = keys.filter((k) => started && k >= started && !deload.has(k));
  const skipped = keys.filter((k) => started && k >= started && deload.has(k)).length;
  const groups = {};
  for (const g of GROUPS16) {
    const total = used.reduce((a, k) => a + (weeks.get(k)[g.key] || 0), 0);
    const avg = used.length ? round(total / used.length) : 0;
    groups[g.key] = { avg, soFar: round(weeks.get(thisWeek)[g.key] || 0), band: band(avg) };
  }
  return { ready: used.length > 0, weeks: used.length, skipped, groups, unknown };
}

const round = (x) => Math.round(x * 2) / 2;

export { GUIDE };
