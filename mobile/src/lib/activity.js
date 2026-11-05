// What the watch tells us through Health Connect, as plain data (tested in
// activity.test.js). The native reads are in store/native.js (Health.readDaily)
// and land in data.health_daily: { 'YYYY-MM-DD': { steps, active_kcal,
// sleep_min, resting_hr } }, one entry per day, any field may be missing.
import { addDays } from './dates.js';

export const KEEP_DAYS = 60;
// Watches tend to overcount active calories, and eating every one of them
// back stalls fat loss, so only part of them counts toward the target.
export const ACTIVE_KCAL_SHARE = 0.75;
const MIN_DAYS = 4; // worn days in the last week before the targets follow it
// Fewer steps than this means the watch was off most of the day: skip it.
export const WORN_STEPS = 2000;
const BASELINE_DAYS = 14;
const MIN_BASELINE = 5;

/** Merge newly read days in (newer reads win), keeping the last KEEP_DAYS. */
export function mergeDaily(data, days, today) {
  const cutoff = addDays(today, -KEEP_DAYS);
  const next = { ...(data.health_daily || {}) };
  for (const d of days) {
    if (!d?.date) continue;
    const clean = {};
    if (d.steps >= 0 && d.steps < 200000) clean.steps = Math.round(d.steps);
    if (d.active_kcal >= 0 && d.active_kcal < 10000) clean.active_kcal = Math.round(d.active_kcal);
    if (d.sleep_min > 0 && d.sleep_min < 24 * 60) clean.sleep_min = Math.round(d.sleep_min);
    if (d.resting_hr > 25 && d.resting_hr < 150) clean.resting_hr = Math.round(d.resting_hr);
    if (Object.keys(clean).length) next[d.date] = { ...(next[d.date] || {}), ...clean };
  }
  for (const k of Object.keys(next)) if (k < cutoff) delete next[k];
  return { ...data, health_daily: next };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The watch was worn that day: it has active calories and enough steps. */
export function worn(day) {
  return day?.active_kcal != null && (day.steps ?? 0) >= WORN_STEPS;
}

/** Average active calories over the worn days of the last 7 full days (today
 * is still going), or null with fewer than MIN_DAYS worn days. */
export function activeKcalAverage(daily, today) {
  const vals = [];
  for (let i = 1; i <= 7; i += 1) {
    const d = daily?.[addDays(today, -i)];
    if (worn(d)) vals.push(d.active_kcal);
  }
  if (vals.length < MIN_DAYS) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** TDEE from the watch: BMR x 1.2 covers everyday life, plus a share of the
 * active calories the watch measured, kept within the sedentary..very active
 * range so one odd week can't swing it far. */
export function watchTdee(bmrKcal, activeAvg) {
  const t = bmrKcal * 1.2 + activeAvg * ACTIVE_KCAL_SHARE;
  return Math.min(Math.max(t, bmrKcal * 1.2), bmrKcal * 1.9);
}

/** How rested you look today, from last night's sleep and this morning's
 * resting heart rate against your own last two weeks.
 * { level: 'good'|'caution'|'easy'|'unknown', reasons, sleep_min, resting_hr, sleep_base, hr_base } */
export function readiness(daily, today) {
  const t = daily?.[today] || {};
  const prior = [];
  for (let i = 1; i <= BASELINE_DAYS; i += 1) {
    const d = daily?.[addDays(today, -i)];
    if (d) prior.push(d);
  }
  const sleeps = prior.map((d) => d.sleep_min).filter((v) => v != null);
  const hrs = prior.map((d) => d.resting_hr).filter((v) => v != null);
  const sleepBase = sleeps.length >= MIN_BASELINE ? median(sleeps) : null;
  const hrBase = hrs.length >= MIN_BASELINE ? median(hrs) : null;
  const reasons = [];
  if (t.sleep_min != null && (t.sleep_min < 6 * 60 || (sleepBase != null && t.sleep_min < sleepBase - 90))) reasons.push('short sleep');
  if (t.resting_hr != null && hrBase != null && t.resting_hr >= hrBase + 5) reasons.push('resting heart rate up');
  let level = 'unknown';
  if (t.sleep_min != null || t.resting_hr != null) level = reasons.length >= 2 ? 'easy' : reasons.length ? 'caution' : 'good';
  return { level, reasons, sleep_min: t.sleep_min ?? null, resting_hr: t.resting_hr ?? null, sleep_base: sleepBase, hr_base: hrBase };
}

export const READINESS_TEXT = {
  good: 'Well recovered. Train as planned.',
  caution: 'A bit under-recovered. Train, but leave an extra rep in the tank.',
  easy: 'Poorly recovered. Go lighter today, or swap to recovery.',
  unknown: '',
};

/** "7h 20m" */
export function hm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
