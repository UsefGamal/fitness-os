// Quests: daily habits you tick by hand, plus weekly quests and once-ever
// milestones earned from logged data. Mirrors quest_engine.py and
// routers/bonus.py, except the week starts on Sunday like the rest of the
// app (the old site used ISO Monday weeks).
import { daysBetween, weekStart } from './dates.js';
import { nextId } from './data.js';
import { profileOf } from './macros.js';

const byKey = (quests) => Object.fromEntries(quests.bonus_tasks.map((t) => [t.key, t]));

export function totalPoints(data) {
  return data.bonus_logs.reduce((s, b) => s + (b.points || 0), 0);
}

export function doneKeys(data, today, quests) {
  const tasks = byKey(quests);
  const start = weekStart(today);
  const done = new Set();
  for (const b of data.bonus_logs) {
    const t = tasks[b.task_key];
    if (!t) continue;
    if (t.frequency === 'daily' && b.log_date === today) done.add(b.task_key);
    if (t.frequency === 'weekly' && b.log_date >= start && b.log_date <= today) done.add(b.task_key);
    if (t.frequency === 'once') done.add(b.task_key);
  }
  return done;
}

/** Tick or untick a daily habit for today. Weekly and once quests are earned, not ticked. */
export function toggleDaily(data, today, key, quests) {
  const task = byKey(quests)[key];
  if (!task || task.frequency !== 'daily') return data;
  const existing = data.bonus_logs.find((b) => b.log_date === today && b.task_key === key);
  if (existing) return { ...data, bonus_logs: data.bonus_logs.filter((b) => b !== existing) };
  return { ...data, bonus_logs: [...data.bonus_logs, { id: nextId(data.bonus_logs), log_date: today, task_key: key, points: task.points }] };
}

export function longestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Weekly quests (E7-S3): three real sessions can be earned any day; the
 * "every day this week" quests only on the week's last day, so nothing is
 * awarded on day 1 for one tick. */
export function weeklyConditions(data, today) {
  const start = weekStart(today);
  const elapsed = daysBetween(start, today) + 1;
  const weekDone = elapsed >= 7;
  const inWeek = (d) => d >= start && d <= today;
  const sessionDays = new Set(data.workouts.filter((w) => inWeek(w.log_date)).map((w) => w.log_date));
  const logs = data.bonus_logs.filter((b) => inWeek(b.log_date));
  const checkinDays = new Set(logs.map((b) => b.log_date));
  const prepDays = new Set(logs.filter((b) => b.task_key === 'meal_prep').map((b) => b.log_date));
  return {
    three_sessions_week: sessionDays.size >= 3,
    no_missed_week: weekDone && checkinDays.size >= 7,
    meal_prep_week: weekDone && prepDays.size >= 7,
  };
}

/** Once-ever milestones. The 30-day streak quest is gone (E7-S3): it asked
 * for training on rest days. Old awards of it still count their points. */
export function onceConditions(data) {
  let lost5 = false;
  if (data.body_logs.length) {
    const start = profileOf(data).start_weight_kg || data.body_logs[0].weight_kg;
    const lowest = Math.min(...data.body_logs.map((b) => b.weight_kg));
    lost5 = start - lowest >= 5;
  }
  return {
    first_5kg: lost5,
    first_deload: data.workouts.some((w) => w.is_deload),
  };
}

/** Award any weekly/once quest that just became true. Returns the same object when nothing changed. */
export function syncQuests(data, today, quests) {
  const tasks = byKey(quests);
  const done = doneKeys(data, today, quests);
  const met = [...Object.entries(weeklyConditions(data, today)), ...Object.entries(onceConditions(data))]
    .filter(([key, ok]) => ok && tasks[key] && !done.has(key))
    .map(([key]) => key);
  if (!met.length) return data;
  let id = nextId(data.bonus_logs);
  const rows = met.map((key) => ({ id: id++, log_date: today, task_key: key, points: tasks[key].points }));
  return { ...data, bonus_logs: [...data.bonus_logs, ...rows] };
}

/** { current, next, pct, level } from content/milestones.py's thresholds. */
export function badgeProgress(points, quests) {
  let current = null;
  let next = null;
  for (const [threshold, name, tier] of quests.milestones) {
    if (points >= threshold) current = { threshold, name, tier };
    else { next = { threshold, name, tier }; break; }
  }
  const floor = current ? current.threshold : 0;
  const pct = next ? Math.round(((points - floor) / (next.threshold - floor)) * 100) : 100;
  return { current, next, pct, level: 1 + Math.floor(points / 50) };
}

