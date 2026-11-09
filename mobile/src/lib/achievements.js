// Badges for milestones, worked out from the data each time (nothing to
// keep in sync). When one is first earned the app plays a fanfare and keeps
// the date in data.achievements = { id: 'YYYY-MM-DD' }. Pure helpers,
// tested in achievements.test.js.
import { GROUPS, totalVolume, weekStreaks } from './insights.js';
import { e1rm, isWorkSet } from './data.js';
import { weekStart } from './dates.js';

const gymCount = (s) => s.gym;

// Each badge has its own icon, a colour per family (workouts, streaks, bests,
// volume, lifts, body…) and a tier within its family (1 = first step).
export const BADGES = [
  { id: 'first', label: 'First step', note: 'Log your first workout', goal: 1, value: gymCount, icon: 'dumbbell', tone: 'blue', tier: 1 },
  { id: 'w10', label: 'Ten in', note: '10 workouts', goal: 10, value: gymCount, icon: 'dumbbell', tone: 'blue', tier: 2 },
  { id: 'w50', label: 'Regular', note: '50 workouts', goal: 50, value: gymCount, icon: 'dumbbell', tone: 'blue', tier: 3 },
  { id: 'w100', label: 'Hundred club', note: '100 workouts', goal: 100, value: gymCount, icon: 'dumbbell', tone: 'blue', tier: 4 },
  { id: 'streak4', label: 'A month strong', note: 'Train 4 weeks in a row', goal: 4, value: (s) => s.longestWeeks, icon: 'flame', tone: 'orange', tier: 1 },
  { id: 'streak12', label: 'Habit', note: 'Train 12 weeks in a row', goal: 12, value: (s) => s.longestWeeks, icon: 'flame', tone: 'orange', tier: 2 },
  { id: 'pr1', label: 'New best', note: 'Set your first personal best', goal: 1, value: (s) => s.prs, icon: 'medal', tone: 'gold', tier: 1 },
  { id: 'pr25', label: 'Getting stronger', note: '25 personal bests', goal: 25, value: (s) => s.prs, icon: 'medal', tone: 'gold', tier: 2 },
  { id: 'ton10', label: '10 tonnes', note: 'Lift 10,000 kg in total', goal: 10000, value: (s) => s.volume, icon: 'kettlebell', tone: 'purple', tier: 1 },
  { id: 'ton100', label: '100 tonnes', note: 'Lift 100,000 kg in total', goal: 100000, value: (s) => s.volume, icon: 'kettlebell', tone: 'purple', tier: 2 },
  { id: 'early10', label: 'Early bird', note: 'Start 10 workouts before 8 AM', goal: 10, value: (s) => s.early, icon: 'sunrise', tone: 'pink', tier: 1 },
  { id: 'full', label: 'Head to toe', note: 'Train all six muscle groups in one week', goal: 6, value: (s) => s.bestWeekGroups, icon: 'person', tone: 'teal', tier: 1 },
  { id: 'bench1', label: 'Bodyweight bench', note: 'Bench press your bodyweight (est. 1RM)', goal: 1, value: (s) => s.ratio.bench, unit: '× BW', icon: 'barbell', tone: 'indigo', tier: 1 },
  { id: 'squat15', label: 'Strong legs', note: 'Squat 1.5 × your bodyweight (est. 1RM)', goal: 1.5, value: (s) => s.ratio.squat, unit: '× BW', icon: 'barbell', tone: 'indigo', tier: 2 },
  { id: 'dead2', label: 'Double deadlift', note: 'Deadlift 2 × your bodyweight (est. 1RM)', goal: 2, value: (s) => s.ratio.deadlift, unit: '× BW', icon: 'barbell', tone: 'indigo', tier: 3 },
  { id: 'lost5', label: '5 kg down', note: 'Weigh 5 kg less than your first weigh-in', goal: 5, value: (s) => s.lost, unit: 'kg', icon: 'scale', tone: 'green', tier: 1 },
  { id: 'waist5', label: 'Belt notch', note: 'Waist 5 cm smaller than your first measure', goal: 5, value: (s) => s.waist, unit: 'cm', icon: 'tape', tone: 'green', tier: 1 },
  { id: 'meals7', label: 'Clean week', note: 'Tick every meal for a whole week', goal: 1, value: (s) => s.mealWeeks, icon: 'meals', tone: 'green', tier: 1 },
  { id: 'weigh30', label: 'On the scale', note: 'Log 30 weigh-ins', goal: 30, value: (s) => s.weighIns, icon: 'scale', tone: 'green', tier: 2 },
];

/** Count of sets that beat every earlier set of the same exercise. */
export function countPrs(data) {
  const best = new Map();
  let prs = 0;
  const workouts = [...data.workouts].sort((a, b) => (a.log_date === b.log_date ? a.id - b.id : a.log_date < b.log_date ? -1 : 1));
  for (const w of workouts) {
    for (const s of w.sets) {
      if (!isWorkSet(s)) continue;
      const score = e1rm(s.weight_kg, s.reps);
      if (!(score > 0)) continue;
      const prev = best.get(s.exercise_id);
      if (prev !== undefined && score > prev) prs += 1;
      if (prev === undefined || score > prev) best.set(s.exercise_id, score);
    }
  }
  return prs;
}

function bestWeekGroups(data) {
  const groupOf = new Map(data.exercises.map((e) => [e.id, e.muscle_group]));
  const weeks = new Map();
  for (const w of data.workouts) {
    const k = weekStart(w.log_date);
    if (!weeks.has(k)) weeks.set(k, new Set());
    for (const s of w.sets) {
      if (!isWorkSet(s)) continue;
      const g = groupOf.get(s.exercise_id);
      if (GROUPS.includes(g)) weeks.get(k).add(g);
    }
  }
  return Math.max(0, ...[...weeks.values()].map((s) => s.size));
}

// Big lifts by name: the plan's own and common catalogue names.
const LIFTS = {
  bench: /bench press/i,
  squat: /^(?!.*(split|goblet|jump|sissy|pistol)).*squat/i,
  deadlift: /deadlift/i,
};

/** Best estimated 1RM of each big lift divided by the latest bodyweight. */
export function liftRatios(data) {
  const out = { bench: 0, squat: 0, deadlift: 0 };
  const bw = data.body_logs.length ? data.body_logs[data.body_logs.length - 1].weight_kg : null;
  if (!bw) return out;
  const names = new Map(data.exercises.map((e) => [e.id, e.name]));
  for (const w of data.workouts) {
    for (const s of w.sets) {
      if (!isWorkSet(s)) continue;
      const name = names.get(s.exercise_id) || '';
      const score = e1rm(s.weight_kg, s.reps);
      for (const [k, re] of Object.entries(LIFTS)) if (re.test(name)) out[k] = Math.max(out[k], Math.round((score / bw) * 100) / 100);
    }
  }
  return out;
}

/** Drop from the first value of a body field to the latest one (0 if up). */
function drop(logs, field) {
  const rows = logs.filter((b) => b[field] != null);
  if (rows.length < 2) return 0;
  return Math.max(0, Math.round((rows[0][field] - rows[rows.length - 1][field]) * 10) / 10);
}

/** Sunday-start weeks in which every meal slot was ticked on all 7 days. */
export function fullMealWeeks(data, slots = 5) {
  const perDay = new Map();
  for (const m of data.meal_logs || []) if (m.completed) perDay.set(m.log_date, (perDay.get(m.log_date) || 0) + 1);
  const perWeek = new Map();
  for (const [d, n] of perDay) if (n >= slots) perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) || 0) + 1);
  return [...perWeek.values()].filter((n) => n >= 7).length;
}

export function badgeStats(data, today) {
  return {
    gym: data.workouts.filter((w) => w.workout_type === 'gym' && w.sets.length).length,
    longestWeeks: weekStreaks(data, today).longest,
    prs: countPrs(data),
    volume: totalVolume(data),
    early: data.workouts.filter((w) => w.started_at && new Date(w.started_at).getHours() < 8).length,
    bestWeekGroups: bestWeekGroups(data),
    weighIns: data.body_logs.length,
    ratio: liftRatios(data),
    lost: drop(data.body_logs, 'weight_kg'),
    waist: drop(data.body_logs, 'waist_cm'),
    mealWeeks: fullMealWeeks(data),
  };
}

/** Every badge with { earned, value, fraction, date }. */
export function badges(data, today) {
  const stats = badgeStats(data, today);
  const kept = data.achievements || {};
  return BADGES.map((b) => {
    const value = b.value(stats);
    return { ...b, value, earned: value >= b.goal, fraction: Math.min(1, value / b.goal), date: kept[b.id] || null };
  });
}

/** Badges earned now that aren't recorded yet; record them with
 * `recordBadges`. */
export function newBadges(data, today) {
  const kept = data.achievements || {};
  return badges(data, today).filter((b) => b.earned && !kept[b.id]);
}

export function recordBadges(data, ids, today) {
  if (!ids.length) return data;
  return { ...data, achievements: { ...(data.achievements || {}), ...Object.fromEntries(ids.map((id) => [id, today])) } };
}
