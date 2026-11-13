// The reward map (SA-02/03): every moment that earns a sound belongs to
// exactly one tier, so feedback stays meaningful instead of turning into
// noise. Pure helpers, tested in rewards.test.js; store/feedback.js plays them.
//
//   tick  a set, a meal or water logged: short and soft, every time
//   done  a workout saved, every meal of the day ticked
//   rare  a real personal best (never a first-time baseline), later the
//         week kept and the goal reached
//
// Rules from the panel's psychology review: the same event always gets the
// same reward, nothing random, nothing escalates within a session, unticking
// is silent, and nothing celebrates eating less or a weight change.
// Functional cues (rest start, 3-2-1, rest done, intervals) are not rewards:
// they follow the separate Sounds switch.

export const TIERS = {
  set: 'tick',
  meal: 'tick',
  water: 'tick',
  mealsDone: 'done',
  workoutSaved: 'done',
  pr: 'rare',
};

export const REWARD_LEVELS = { off: 'Off', gentle: 'Gentle', full: 'Full' };
export const DEFAULT_LEVEL = 'gentle';

/** How loud each tier plays, as a share of the chosen volume. */
const SCALE = {
  gentle: { tick: 0.4, done: 0.85, rare: 1 },
  full: { tick: 0.75, done: 1, rare: 1 },
};

/** After this many days of ticking meals, "all meals done" drops to a tick:
 * the daily chime would otherwise wear out (reward fatigue). */
export const MEALS_DONE_FADES_AFTER = 14;

export function isReward(event) {
  return Object.prototype.hasOwnProperty.call(TIERS, event);
}

/** The tier this event plays at, after the fatigue rule, or null. */
export function tierFor(event, { daysUsing = 0 } = {}) {
  const tier = TIERS[event];
  if (!tier) return null;
  if (event === 'mealsDone' && daysUsing >= MEALS_DONE_FADES_AFTER) return 'tick';
  return tier;
}

/** Share of the volume to play a reward at; 0 = no sound. */
export function rewardScale(event, { level = DEFAULT_LEVEL, daysUsing = 0 } = {}) {
  const tier = tierFor(event, { daysUsing });
  if (!tier || !SCALE[level]) return 0;
  return SCALE[level][tier];
}

/** Days since the first meal tick, for the fatigue rule. */
export function daysTickingMeals(data, today) {
  let first = null;
  for (const m of data?.meal_logs || []) if (m.completed && (!first || m.log_date < first)) first = m.log_date;
  if (!first) return 0;
  return Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000);
}

/** Which event ticking a meal is: null when it was unticked (silent),
 * 'mealsDone' when it completes the day, else 'meal'. */
export function mealTickEvent({ nowDone, doneBefore, slots }) {
  if (!nowDone) return null;
  return doneBefore + 1 >= slots ? 'mealsDone' : 'meal';
}

// Vibration strength (FEEL-1): cheap phone motors barely move on a light
// tap, so "Strong" makes the ticks heavy and adds a short buzz to a set.
export const HAPTIC_LEVELS = { off: 'Off', light: 'Light', strong: 'Strong' };

/** The vibration setting. Before FEEL-1 there was only the Vibrate switch,
 * so an unset level follows it: on is Light, off is Off. */
export function hapticLevel(training) {
  const level = training?.haptics;
  if (Object.prototype.hasOwnProperty.call(HAPTIC_LEVELS, level)) return level;
  return training?.vibrate === false ? 'off' : 'light';
}

/** How to buzz for an event at a level: null for nothing, 'default' for
 * the usual pattern, or { impact, vibrateMs } for a stronger tick. */
export function hapticFor(event, level) {
  if (level === 'off') return null;
  if (level === 'strong' && (event === 'set' || event === 'meal')) {
    return { impact: 'Heavy', vibrateMs: event === 'set' ? 30 : 0 };
  }
  return 'default';
}
