// Badges for milestones, worked out from the data each time (nothing to
// keep in sync). When one is first earned the app plays a fanfare and keeps
// the date in data.achievements = { id: 'YYYY-MM-DD' }. Pure helpers,
// tested in achievements.test.js.
import { GROUPS, totalVolume, weekStreaks } from './insights.js';
import { weekStart } from './dates.js';

const gymCount = (s) => s.gym;

export const BADGES = [
  { id: 'first', label: 'First step', note: 'Log your first workout', goal: 1, value: gymCount },
  { id: 'w10', label: 'Ten in', note: '10 workouts', goal: 10, value: gymCount },
  { id: 'w50', label: 'Regular', note: '50 workouts', goal: 50, value: gymCount },
  { id: 'w100', label: 'Hundred club', note: '100 workouts', goal: 100, value: gymCount },
  { id: 'streak4', label: 'A month strong', note: 'Train 4 weeks in a row', goal: 4, value: (s) => s.longestWeeks },
  { id: 'streak12', label: 'Habit', note: 'Train 12 weeks in a row', goal: 12, value: (s) => s.longestWeeks },
  { id: 'pr1', label: 'New best', note: 'Set your first personal best', goal: 1, value: (s) => s.prs },
  { id: 'pr25', label: 'Getting stronger', note: '25 personal bests', goal: 25, value: (s) => s.prs },
  { id: 'ton10', label: '10 tonnes', note: 'Lift 10,000 kg in total', goal: 10000, value: (s) => s.volume },
  { id: 'ton100', label: '100 tonnes', note: 'Lift 100,000 kg in total', goal: 100000, value: (s) => s.volume },
  { id: 'early10', label: 'Early bird', note: 'Start 10 workouts before 8 AM', goal: 10, value: (s) => s.early },
  { id: 'full', label: 'Head to toe', note: 'Train all six muscle groups in one week', goal: 6, value: (s) => s.bestWeekGroups },
  { id: 'weigh30', label: 'On the scale', note: 'Log 30 weigh-ins', goal: 30, value: (s) => s.weighIns },
];

/** Count of sets that beat every earlier set of the same exercise. */
export function countPrs(data) {
  const best = new Map();
  let prs = 0;
  const workouts = [...data.workouts].sort((a, b) => (a.log_date === b.log_date ? a.id - b.id : a.log_date < b.log_date ? -1 : 1));
  for (const w of workouts) {
    for (const s of w.sets) {
      const score = s.reps === 1 ? s.weight_kg : (s.weight_kg || 0) * (1 + (s.reps || 0) / 30);
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
      const g = groupOf.get(s.exercise_id);
      if (GROUPS.includes(g)) weeks.get(k).add(g);
    }
  }
  return Math.max(0, ...[...weeks.values()].map((s) => s.size));
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
