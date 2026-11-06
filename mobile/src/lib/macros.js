// Daily macro targets. Mifflin-St Jeor BMR x activity multiplier = TDEE,
// then by goal direction (E3-S1):
//   lose:     minus the deficit for the pace to reach the goal by the goal
//             date, capped at 25% of TDEE, 1000 kcal and 1% of body weight a
//             week (E3-S2), and never below 1500 kcal (men) / 1200 (women);
//   maintain: TDEE;
//   gain:     TDEE + 300 kcal (about 0.25-0.5% of body weight a week);
//   recomp:   lose fat and build muscle (E3-S13): a small deficit of
//             10-15% of TDEE (the goal pace inside that band, 12.5% without
//             one), same floors.
// Protein is 2.0 / 1.8 / 1.6 / 2.2 g per kg of GOAL weight (lose /
// maintain / gain / recomp) and fat 0.8 g/kg of goal weight (E3-S3);
// carbs fill the rest.
// content/tdee.py is the frozen old maths (2 g/kg of current weight, a flat
// 1200 floor); this file has moved on from it on purpose.
// Phone only, and only when switched on in Settings: with enough days of
// watch data from Health Connect, the TDEE follows the measured active calories instead of the activity
// level (lib/activity.js). The web app has no watch data, so it never does.
import { activeKcalAverage, watchTdee } from './activity.js';
import { addDays, daysBetween } from './dates.js';

export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const KCAL_PER_KG_FAT = 7700;
const MAX_DAILY_DEFICIT = 1000;
// The share-of-TDEE cap is off (1 = no cap): with Yusuf's maintenance near
// 2940 kcal a quarter cap held him at 0.67 kg a week and flagged most of his
// meal plan. The friends build turns it back on at 0.25 (rule A, E3-S13)
// through content.nutrition.max_deficit_share.
export const MAX_DEFICIT_SHARE = 1; // of TDEE
export const RECOMP_DEFICIT = { low: 0.1, high: 0.15, default: 0.125 }; // of TDEE
export const MAX_LOSS_SHARE_BW = 0.01; // of body weight a week
export const MIN_KCAL = { male: 1500, female: 1200 };
export const GAIN_SURPLUS = 300;
export const PROTEIN_G_PER_KG = { lose: 2.0, maintain: 1.8, gain: 1.6, recomp: 2.2 };
export const DIRECTIONS = ['lose', 'recomp', 'maintain', 'gain'];
const FAT_G_PER_KG = 0.8;
const MIN_BMI = 18.5;

/** The goal being worked towards: the latest one that hasn't ended. */
export function currentGoal(data) {
  const goals = Array.isArray(data.goals) ? data.goals : [];
  for (let i = goals.length - 1; i >= 0; i -= 1) if (!goals[i].ended_on) return goals[i];
  return null;
}

/** The profile and the current goal as one flat object (the shape the
 * Profile form and the maths use). No defaults: what isn't filled in is
 * missing, and the targets fall back to the plan's band until it is. */
export function profileOf(data) {
  const g = currentGoal(data);
  const goal = g ? { direction: g.direction || 'lose', start_weight_kg: g.start_weight_kg ?? null, goal_weight_low_kg: g.target_low_kg ?? null, goal_weight_high_kg: g.target_high_kg ?? null, goal_date: g.target_date ?? null } : {};
  return { ...(data.profile || {}), ...goal };
}

/** Save the Profile form: body facts to profile, goal fields to the
 * current goal (a first goal is created if there is none). */
export function saveProfile(data, form, today) {
  const { start_weight_kg, goal_weight_low_kg, goal_weight_high_kg, goal_date, direction, ...body } = form;
  const goalFields = { ...(direction ? { direction } : {}), start_weight_kg: start_weight_kg ?? null, target_low_kg: goal_weight_low_kg ?? null, target_high_kg: goal_weight_high_kg ?? null, target_date: goal_date ?? null };
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const g = currentGoal(data);
  const nextGoals = g
    ? goals.map((x) => (x === g ? { ...x, ...goalFields } : x))
    : [...goals, { id: `g${goals.length + 1}`, set_on: today, direction: 'lose', rate_pct_bw_wk: null, ended_on: null, ...goalFields }];
  return { ...data, profile: { ...(data.profile || {}), ...body }, goals: nextGoals };
}

/** The date the plan's pace is counted from. */
export function planStartOf(data, nutrition) {
  return data.diet?.plan_start_date || nutrition.plan_start_date;
}

export function bmr(weightKg, heightCm, ageYears, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === 'male' ? base + 5 : base - 161;
}

export function tdee(bmrKcal, level) {
  return bmrKcal * (ACTIVITY[level] ?? ACTIVITY.moderate);
}

// Python's round() rounds halves to even; match it so both sides agree.
export function pyRound(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** The largest daily deficit that is still safe at this weight and TDEE. */
export function maxDeficit(tdeeKcal, weightKg, share = MAX_DEFICIT_SHARE) {
  return Math.min(MAX_DAILY_DEFICIT, tdeeKcal * share, (weightKg * MAX_LOSS_SHARE_BW * KCAL_PER_KG_FAT) / 7);
}

/** Daily kcal for a goal direction, with the reasons it isn't the plain
 * pace maths: { kcal, deficit, reasons }. Reasons: 'capped' (the pace asked
 * for needs more than the safe deficit), 'floor' (held up at the minimum),
 * 'no_pace' (losing, but no goal date or start weight to set a pace). */
export function energyTarget({ tdee: t, rate, weight, mode = 'lose', gender, share = MAX_DEFICIT_SHARE }) {
  if (mode === 'maintain') return { kcal: pyRound(t), deficit: 0, reasons: [] };
  if (mode === 'gain') return { kcal: pyRound(t + GAIN_SURPLUS), deficit: -GAIN_SURPLUS, reasons: [] };
  const reasons = [];
  if (mode === 'recomp') {
    const paced = rate > 0 ? (rate * KCAL_PER_KG_FAT) / 7 : t * RECOMP_DEFICIT.default;
    const want = Math.min(Math.max(paced, t * RECOMP_DEFICIT.low), t * RECOMP_DEFICIT.high);
    const floorR = MIN_KCAL[gender] ?? MIN_KCAL.female;
    let kcalR = pyRound(t - Math.min(want, maxDeficit(t, weight, share)));
    if (kcalR < floorR) { kcalR = floorR; reasons.push('floor'); }
    return { kcal: kcalR, deficit: Math.max(0, pyRound(t) - kcalR), reasons };
  }
  if (rate == null) reasons.push('no_pace');
  const asked = rate > 0 ? (rate * KCAL_PER_KG_FAT) / 7 : 0;
  const cap = maxDeficit(t, weight, share);
  if (asked > cap) reasons.push('capped');
  const floor = MIN_KCAL[gender] ?? MIN_KCAL.female;
  let kcal = pyRound(t - Math.min(asked, cap));
  if (kcal < floor) { kcal = floor; reasons.push('floor'); }
  return { kcal, deficit: Math.max(0, pyRound(t) - kcal), reasons };
}

/** Old two-argument form, kept for the drift maths: the lose-mode kcal. */
export function targetKcal(tdeeKcal, ratePerWeek, weightKg = Infinity, gender = 'male') {
  return energyTarget({ tdee: tdeeKcal, rate: ratePerWeek, weight: weightKg, gender }).kcal;
}

export function macroSplit(kcal, refWeightKg, mode = 'lose') {
  const protein = pyRound(refWeightKg * (PROTEIN_G_PER_KG[mode] ?? PROTEIN_G_PER_KG.lose));
  const fat = pyRound(refWeightKg * FAT_G_PER_KG);
  const carbs = pyRound(Math.max(kcal - protein * 4 - fat * 9, 0) / 4);
  return { protein, carbs, fat, fiber: pyRound((kcal / 1000) * 14), kcal };
}

/** Problems with a goal before it is saved: ['bmi'] when the low goal
 * weight is under BMI 18.5 for this height. */
export function goalIssues(p) {
  const out = [];
  if (p.height_cm && p.goal_weight_low_kg != null && p.goal_weight_low_kg / (p.height_cm / 100) ** 2 < MIN_BMI) out.push('bmi');
  return out;
}

/** The lowest goal weight allowed for a height (BMI 18.5), to 0.5 kg up. */
export function minGoalWeight(heightCm) {
  return Math.ceil(MIN_BMI * (heightCm / 100) ** 2 * 2) / 2;
}

/** The earliest date the goal can be reached at the safe pace, from today
 * at this weight; null when already there or not losing. */
export function safeGoalDate(t) {
  if (!t || t.mode !== 'lose' || t.goal_weight == null || t.weight <= t.goal_weight || !t.tdee) return null;
  const perWeek = (maxDeficit(t.tdee, t.weight, t.share ?? MAX_DEFICIT_SHARE) * 7) / KCAL_PER_KG_FAT;
  const days = Math.ceil(((t.weight - t.goal_weight) / perWeek) * 7);
  return addDays(t.today, days);
}

export function targetRate(startWeight, goalMid, startDate, goalDate) {
  const days = daysBetween(startDate, goalDate);
  if (days <= 0) return null;
  return Math.round(((startWeight - goalMid) / days) * 7 * 1000) / 1000;
}

/** Targets plus how they were worked out; falls back to the plan's static band. */
export function macroTargets(data, nutrition, today) {
  const p = profileOf(data);
  const logs = data.body_logs;
  const current = logs.length ? logs[logs.length - 1].weight_kg : null;
  const start = p.start_weight_kg || (logs.length ? logs[0].weight_kg : null);
  const weight = current ?? start;
  const age = p.date_of_birth ? daysBetween(p.date_of_birth, today) / 365.25 : NaN;
  if (weight == null || !p.height_cm || !p.gender || !(age >= 10 && age <= 100)) {
    const m = nutrition.macro_targets;
    return { ...m, kcal: pyRound(m.protein * 4 + m.carbs * 4 + m.fat * 9), source: 'plan' };
  }
  const hasGoal = p.goal_weight_low_kg != null && p.goal_weight_high_kg != null && p.goal_date;
  const goalMid = hasGoal ? (p.goal_weight_low_kg + p.goal_weight_high_kg) / 2 : null;
  const rate = start != null && hasGoal ? targetRate(start, goalMid, planStartOf(data, nutrition), p.goal_date) : null;
  const b = bmr(weight, p.height_cm, age, p.gender);
  const activeAvg = data.settings?.health?.adaptive === true ? activeKcalAverage(data.health_daily, today) : null;
  const t = activeAvg != null ? watchTdee(b, activeAvg) : tdee(b, p.activity_level);
  const mode = DIRECTIONS.includes(currentGoal(data)?.direction) ? currentGoal(data).direction : 'lose';
  const share = nutrition.max_deficit_share ?? MAX_DEFICIT_SHARE;
  const energy = energyTarget({ tdee: t, rate, weight, mode, gender: p.gender, share });
  return {
    ...macroSplit(energy.kcal, goalMid ?? weight, mode),
    source: activeAvg != null ? 'watch' : 'profile',
    mode,
    reasons: energy.reasons,
    deficit: energy.deficit,
    // The pace the deficit really gives, in kg a week.
    pace: Math.round(((energy.deficit * 7) / KCAL_PER_KG_FAT) * 100) / 100,
    goal_weight: goalMid,
    bmr: Math.round(b),
    tdee: Math.round(t),
    rate,
    weight,
    today,
    ...(share !== MAX_DEFICIT_SHARE ? { share } : {}),
    ...(activeAvg != null ? { active_avg: activeAvg } : {}),
  };
}
