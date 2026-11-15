// The first-week card (FIRST-1, BIZ-4): five small steps on Home for a new
// phone, each ticking itself when it's done: a first workout, a meal ticked,
// a weigh-in, a backup, the widget. It shows for the two weeks after setup,
// until every step is done or the ✕ hides it. Pure; firstWeek.test.js.
import { daysBetween } from './dates.js';
import { goalDirection } from './macros.js';
import { moduleOn } from './data.js';

export const FIRST_WEEK_DAYS = 14;
export const STEP_KEYS = ['workout', 'meal', 'weigh', 'backup', 'widget'];

const fw = (data) => data.settings?.first_week || {};

/** Weighing isn't a first step for everyone (psychology review): only for
 * a goal that changes weight, with the weight module on and not hidden. */
export function weighStep(data) {
  if (!moduleOn(data, 'weight') || data.safety?.hide_weight) return false;
  return goalDirection(data) !== 'maintain';
}

/** The steps that apply, each with done. `widgetCount`: widgets on the home
 * screen now, from the phone (null when it can't say).
 * @returns {{ key: string, done: boolean }[]} */
export function firstWeekSteps(data, { widgetCount = null } = {}) {
  const steps = [];
  steps.push({ key: 'workout', done: (data.workouts || []).some((w) => w.finished_at) });
  if (moduleOn(data, 'meals')) steps.push({ key: 'meal', done: (data.meal_logs || []).some((m) => m.completed) });
  if (weighStep(data)) steps.push({ key: 'weigh', done: (data.body_logs || []).some((b) => b.weight_kg > 0) });
  const auto = data.settings?.auto_backup;
  steps.push({ key: 'backup', done: Boolean(data.settings?.last_backup_at) || auto?.on === true });
  steps.push({ key: 'widget', done: fw(data).widget === true || (widgetCount ?? 0) > 0 });
  return steps;
}

/** Does Home show the card today? Only after setup on this phone (an older
 * phone that never ran setup has no first week), inside two weeks of it,
 * not hidden, with a step still to do. */
export function showFirstWeek(data, today, steps) {
  const since = data.setup?.done_on;
  if (!since || fw(data).hidden) return false;
  const days = daysBetween(since, today);
  if (!(days >= 0 && days < FIRST_WEEK_DAYS)) return false;
  return steps.some((s) => !s.done);
}

/** The ✕: the card doesn't come back. */
export function hideFirstWeek(data) {
  return { ...data, settings: { ...data.settings, first_week: { ...fw(data), hidden: true } } };
}

/** "I added it": the phone can't always tell us the widget is there. */
export function markWidgetDone(data) {
  return { ...data, settings: { ...data.settings, first_week: { ...fw(data), widget: true } } };
}
