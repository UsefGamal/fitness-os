// Readiness and data health (charts step 5, BI-01 + BI-29). Readiness says
// when each insight starts and what it still needs, so an empty chart is
// never a mystery. Data health lists what keeps the numbers honest: recent
// weigh-ins, meal logging, watch wear, sets without a known muscle, sets
// that look mistyped, and the last backup. Pure; dataHealth.test.js.
import { isLoadSet, isWorkSet } from './data.js';
import { addDays, daysBetween } from './dates.js';
import { worn } from './activity.js';
import { currentGoal } from './macros.js';
import { paceRange } from './pace.js';
import { measuredBurn } from './measuredBurn.js';
import { muscleVolume } from './muscleVolume.js';
import { weeklyAverages } from './bodyStats.js';
import { kcalHidden } from './safety.js';

export const LIFT_GAP_DAYS = 7;

/** Does any lift have two loaded sessions at least a week apart? */
function liftTrendReady(data, today) {
  const by = new Map();
  for (const w of data.workouts || []) {
    if (w.log_date > today) continue;
    for (const s of w.sets || []) {
      if (!isLoadSet(s) || !(s.weight_kg > 0)) continue;
      const d = by.get(s.exercise_id) || { first: w.log_date, last: w.log_date };
      if (w.log_date < d.first) d.first = w.log_date;
      if (w.log_date > d.last) d.last = w.log_date;
      by.set(s.exercise_id, d);
    }
  }
  return [...by.values()].some((d) => daysBetween(d.first, d.last) >= LIFT_GAP_DAYS);
}

/**
 * [{ key, done, need }] in the order they usually unlock:
 *   pace (weight pace range), weekly (weekly averages), lifts (lift trend),
 *   muscles (muscle averages), burn (what you burn). need is a count for
 *   the "N more" line where there is one. burn is left out when calories
 *   are hidden or gated.
 * @param {import('../types').Data} data @param {any} training
 * @param {string[]} slots @param {string} today */
export function readiness(data, training, slots, today) {
  const pace = paceRange(data.body_logs || [], currentGoal(data), today);
  const weeks = weeklyAverages(data.body_logs || [], today, data);
  const burn = measuredBurn(data, slots, today);
  const out = [
    { key: 'pace', done: pace.ready, need: pace.ready ? 0 : pace.need },
    { key: 'weekly', done: weeks.length >= 2, need: 0 },
    { key: 'lifts', done: liftTrendReady(data, today), need: 0 },
    { key: 'muscles', done: muscleVolume(data, training, today).ready, need: 0 },
  ];
  if (burn.reason !== 'hidden') out.push({ key: 'burn', done: burn.ready, need: burn.ready ? 0 : burn.need || 0, why: burn.ready ? null : burn.reason });
  return out;
}

export const HEALTH_DAYS = 28;
export const WATCH_DAYS = 60;
export const BACKUP_OLD_DAYS = 14;

/**
 * Data health rows: [{ key, ok, value, n? }]
 *   weighins: weigh-ins in the last 28 days (ok at 8+)
 *   meals: share of meals ticked in 28 days, 0-100 (ok at 80+); left out
 *     when calories are hidden
 *   watch: worn days out of the last 60 (only when any watch data exists)
 *   unknown: work sets of moves with no known muscle (ok at 0)
 *   suspect: sets that look mistyped: reps over 50, or over 500 kg (ok at 0)
 *   backup: days since the last backup, null if never (ok under 14)
 * @param {import('../types').Data} data @param {any} training
 * @param {string[]} slots @param {string} today @param {number} [now] ms */
export function dataHealth(data, training, slots, today, now = Date.now()) {
  const from = addDays(today, -(HEALTH_DAYS - 1));
  const weighins = new Set((data.body_logs || []).filter((l) => l.weight_kg > 0 && l.log_date >= from && l.log_date <= today).map((l) => l.log_date)).size;
  const rows = [{ key: 'weighins', ok: weighins >= 8, value: weighins }];
  if (!kcalHidden(data) && slots.length) {
    const ticked = (data.meal_logs || []).filter((m) => m.completed && m.log_date >= from && m.log_date <= today && slots.includes(m.meal_slot)).length;
    const pct = Math.round((ticked / (slots.length * HEALTH_DAYS)) * 100);
    rows.push({ key: 'meals', ok: pct >= 80, value: pct });
  }
  const daily = data.health_daily || {};
  if (Object.keys(daily).length) {
    let n = 0;
    for (let i = 1; i <= WATCH_DAYS; i += 1) if (worn(daily[addDays(today, -i)])) n += 1;
    rows.push({ key: 'watch', ok: n >= WATCH_DAYS / 2, value: n, n: WATCH_DAYS });
  }
  rows.push({ key: 'unknown', ...countOk(muscleVolume(data, training, today).unknown) });
  let suspect = 0;
  for (const w of data.workouts || []) for (const s of w.sets || []) if (isWorkSet(s) && ((s.reps || 0) > 50 || (s.weight_kg || 0) > 500)) suspect += 1;
  rows.push({ key: 'suspect', ...countOk(suspect) });
  // A checked automatic backup counts as much as an export (audit DATA-4).
  const auto = data.settings?.auto_backup;
  const autoAt = auto?.on === true && !auto.last_error && Number.isFinite(auto.last_checked_at) ? auto.last_checked_at : null;
  const at = Math.max(data.settings?.last_backup_at || 0, autoAt || 0) || null;
  const ago = at ? Math.max(0, Math.floor((now - at) / 86400000)) : null;
  rows.push({ key: 'backup', ok: ago != null && ago < BACKUP_OLD_DAYS, value: ago });
  return rows;
}

const countOk = (n) => ({ ok: n === 0, value: n });
