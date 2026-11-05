// Daily macro targets. Mirrors content/tdee.py and macro_targets.py:
// Mifflin-St Jeor BMR x activity multiplier = TDEE, minus a deficit from the
// pace needed to hit the goal weight by the goal date (capped at 1000 kcal,
// never below 1200 kcal), then 2 g/kg protein, 0.8 g/kg fat, carbs fill the rest.
// Phone only, and only when switched on in Settings: with enough days of
// watch data from Health Connect, the TDEE follows the measured active calories instead of the activity
// level (lib/activity.js). The web app has no watch data, so it never does.
import { activeKcalAverage, watchTdee } from './activity.js';
import { daysBetween } from './dates.js';

export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const KCAL_PER_KG_FAT = 7700;
const MAX_DAILY_DEFICIT = 1000;
const MIN_DAILY_KCAL = 1200;

// models.py's Profile defaults, used until the profile is filled in.
export const DEFAULT_PROFILE = {
  height_cm: 173,
  date_of_birth: '1999-01-01',
  goal_weight_low_kg: 75,
  goal_weight_high_kg: 80,
  goal_date: '2027-01-18',
  start_weight_kg: null,
  gender: 'male',
  activity_level: 'moderate',
};

export function profileOf(data) {
  return { ...DEFAULT_PROFILE, ...(data.profile || {}) };
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

export function targetKcal(tdeeKcal, ratePerWeek) {
  if (ratePerWeek == null || ratePerWeek <= 0) return pyRound(tdeeKcal);
  const deficit = Math.min((ratePerWeek * KCAL_PER_KG_FAT) / 7, MAX_DAILY_DEFICIT);
  return Math.max(pyRound(tdeeKcal - deficit), MIN_DAILY_KCAL);
}

export function macroSplit(kcal, weightKg) {
  const protein = pyRound(weightKg * 2.0);
  const fat = pyRound(weightKg * 0.8);
  const carbs = pyRound(Math.max(kcal - protein * 4 - fat * 9, 0) / 4);
  return { protein, carbs, fat, fiber: pyRound((kcal / 1000) * 14), kcal };
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
  const age = daysBetween(p.date_of_birth, today) / 365.25;
  if (weight == null || age < 10 || age > 100) {
    const m = nutrition.macro_targets;
    return { ...m, kcal: pyRound(m.protein * 4 + m.carbs * 4 + m.fat * 9), source: 'plan' };
  }
  const goalMid = (p.goal_weight_low_kg + p.goal_weight_high_kg) / 2;
  const rate = start != null ? targetRate(start, goalMid, nutrition.plan_start_date, p.goal_date) : null;
  const b = bmr(weight, p.height_cm, age, p.gender);
  const activeAvg = data.settings?.health?.adaptive === true ? activeKcalAverage(data.health_daily, today) : null;
  const t = activeAvg != null ? watchTdee(b, activeAvg) : tdee(b, p.activity_level);
  return {
    ...macroSplit(targetKcal(t, rate), weight),
    source: activeAvg != null ? 'watch' : 'profile',
    bmr: Math.round(b),
    tdee: Math.round(t),
    rate,
    weight,
    ...(activeAvg != null ? { active_avg: activeAvg } : {}),
  };
}
