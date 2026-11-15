// Goal reached means maintenance (MAINT-1, COACH-9). Jumping straight from
// the cut's calories to maintenance tends to bring a quick rebound, so the
// calories climb in weekly steps of 100-150 kcal for 4-6 weeks ("reverse"),
// a week's step is held when the weight trend climbed that week, and then
// the target is plain maintenance (TDEE). Pure; maintenance.test.js.
import { addDays, daysBetween } from './dates.js';
import { trendSeries } from './progress.js';

export const STEP_MIN = 100;
export const STEP_MAX = 150;
export const MAX_WEEKS = 6;
export const MIN_WEEKS = 4;
/** A week whose trend rose more than this holds that week's step. */
export const CLIMB_KG = 0.25;

const openGoal = (data) => {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  for (let i = goals.length - 1; i >= 0; i -= 1) if (!goals[i].ended_on) return goals[i];
  return null;
};

/** The step and the number of weeks to close the gap from the cut's kcal
 * to maintenance: 100-150 kcal a week over 4-6 weeks. */
export function reversePlan(fromKcal, tdeeKcal) {
  const gap = Math.max(0, Math.round(tdeeKcal - fromKcal));
  if (gap === 0) return { step: 0, weeks: 0, gap };
  const step = Math.min(STEP_MAX, Math.max(STEP_MIN, Math.round(gap / MIN_WEEKS / 5) * 5));
  const weeks = Math.min(MAX_WEEKS, Math.max(1, Math.ceil(gap / step)));
  return { step, weeks, gap };
}

/** The trend weight on or before `date` (null with no weigh-in by then). */
function trendOn(series, date) {
  let out = null;
  for (const p of series) {
    if (p.date > date) break;
    out = p.trend;
  }
  return out;
}

/** Where the reverse stands today. Each finished week since the start adds
 * one step unless the trend rose more than CLIMB_KG in it (a week with too
 * few weigh-ins to tell still steps: the steps are small). After `weeks`
 * finished weeks, or when the steps reach maintenance, it is done.
 * @returns {{ kcal: number, week: number, weeks: number, steps: number, held: number, done: boolean, heldLast: boolean, next_on: string | null }} */
export function reverseStatus(reverse, logs, tdeeKcal, today) {
  const { from_kcal: from, started_on: start } = reverse;
  const plan = reversePlan(from, tdeeKcal);
  const step = reverse.step ?? plan.step;
  const weeks = reverse.weeks ?? plan.weeks;
  const series = trendSeries(logs || []);
  const finished = Math.max(0, Math.floor(daysBetween(start, today) / 7));
  let steps = 0;
  let held = 0;
  let heldLast = false;
  for (let w = 0; w < Math.min(finished, weeks); w += 1) {
    const a = trendOn(series, addDays(start, w * 7));
    const b = trendOn(series, addDays(start, (w + 1) * 7));
    const climbed = a != null && b != null && b - a > CLIMB_KG;
    if (climbed) held += 1;
    else steps += 1;
    heldLast = climbed;
  }
  const done = finished >= weeks || from + steps * step >= tdeeKcal;
  const kcal = done ? Math.round(tdeeKcal) : Math.round(from + steps * step);
  return {
    kcal, week: Math.min(finished + 1, weeks), weeks, steps, held, done, heldLast,
    next_on: done ? null : addDays(start, (finished + 1) * 7),
  };
}

/** The goal is reached and the person can move to maintenance: a lose or
 * recomp goal whose trend is at or under the goal range. */
export function canStartMaintenance(data, progress) {
  const g = openGoal(data);
  if (!g || !['lose', 'recomp'].includes(g.direction || 'lose')) return false;
  return progress?.status === 'reached';
}

/** Show the "goal reached" card? Not after "Not now" for this goal, and
 * not with weight hidden (the card would say what the scale says). */
export function showGoalReached(data, progress) {
  const g = openGoal(data);
  if (data.safety?.hide_weight) return false;
  return canStartMaintenance(data, progress) && data.settings?.goal_reached_hidden !== g.id;
}

export function hideGoalReached(data) {
  const g = openGoal(data);
  return g ? { ...data, settings: { ...data.settings, goal_reached_hidden: g.id } } : data;
}

/** "Start maintenance": the cut goal ends today and a maintain goal starts,
 * holding the weight it reached, with the reverse counted from today's kcal
 * (`fromKcal`, the cut's target) to `tdeeKcal`. */
export function startMaintenance(data, today, { fromKcal, tdeeKcal, weightKg }) {
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const g = openGoal(data);
  const plan = reversePlan(fromKcal, tdeeKcal);
  const ended = goals.map((x) => (x === g ? { ...x, ended_on: today } : x));
  const kg = Number.isFinite(weightKg) ? Math.round(weightKg * 10) / 10 : null;
  const next = {
    id: `g${goals.length + 1}`,
    set_on: today,
    direction: 'maintain',
    start_weight_kg: kg,
    target_low_kg: kg != null ? Math.round((kg - 1) * 10) / 10 : null,
    target_high_kg: kg != null ? Math.round((kg + 1) * 10) / 10 : null,
    target_date: null,
    rate_pct_bw_wk: null,
    ended_on: null,
    ...(plan.weeks ? { reverse: { from_kcal: Math.round(fromKcal), started_on: today, step: plan.step, weeks: plan.weeks } } : {}),
  };
  return { ...data, goals: [...ended, next] };
}
