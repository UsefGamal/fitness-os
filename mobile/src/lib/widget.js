// What the home-screen widget shows, one entry per date for the coming
// week, so it stays right after midnight without the app running.
//
// Each entry:
//   kicker/title/subtitle  the session ("Today · 07:00", "Push", its focus),
//                          or the next one on a rest day
//   streak                 "3" (training days in a row), or ""
//   tonight                "Tonight 20:00 · Zone 2 walk", or ""
//   meals                  [{ time, name, what, done }] in time order; the
//                          widget shows the first one not eaten and not past
//   stats                  "Protein 62/170 g · Water 1.5/3 L"
//   week                   [{ d: 'S', s: 'done'|'train'|'rest'|'missed', today }]
//   route                  where tapping the session opens: 'workout' or 'plan'
import { addDays, longWeekday, shortWeekday } from './dates.js';
import * as D from './data.js';
import { eveningDone, eveningOn } from './evening.js';
import { macroTargets } from './macros.js';
import { activePlan } from './plan.js';
import { mealDayFor, slotLabel } from './meals.js';
import { programDayFor, sessionKeyOn, weekView } from './schedule.js';
import { effectiveTimes } from './ramadan.js';

export const WIDGET_DAYS = 7;
export const WATER_GOAL_ML = 3000;

function optionFor(meal, log) {
  return meal.options.find((o) => o.key === log?.option_key) || meal.options[0];
}

/** "Ful Medames Bowl, Boiled Egg ×2, Whole Wheat Pita Half" */
export function mealWhat(option) {
  const counts = new Map();
  for (const i of option.ingredients || []) counts.set(i, (counts.get(i) || 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

export function widgetDays(data, content, today) {
  const T = activePlan(data, content);
  const N = content.nutrition;
  const moves = data.session_moves || [];
  const times = effectiveTimes(data, content, today);
  const isRest = (d) => sessionKeyOn(d, T, moves) === 'rest';
  const streak = D.trainingStreak(data, today, isRest);
  const trained = new Set(data.workouts.filter((w) => w.finished_at || w.sets.length).map((w) => w.log_date));
  const showMeals = D.moduleOn(data, 'meals');
  const showWater = D.moduleOn(data, 'water');
  const protein = macroTargets(data, N, today).protein;

  const out = [];
  for (let i = 0; i < WIDGET_DAYS; i += 1) {
    const date = addDays(today, i);
    const next = programDayFor(date, T, moves);
    const done = D.workoutOn(data, date);
    const evening = eveningOn(data, date);

    const day = mealDayFor(date, N);
    const meals = showMeals
      ? day.meals
        .map((m) => {
          const log = D.mealLog(data, date, m.slot);
          return { time: times.meal_times[m.slot] || '', name: slotLabel(m.slot), what: mealWhat(optionFor(m, log)), done: Boolean(log?.completed), protein: optionFor(m, log).protein || 0 };
        })
        .sort((a, b) => (a.time < b.time ? -1 : 1))
      : [];
    const eaten = Math.round(meals.filter((m) => m.done).reduce((n, m) => n + m.protein, 0));
    const stats = [];
    if (showMeals) stats.push(`Protein ${eaten}/${protein} g`);
    if (showWater) stats.push(`Water ${(D.waterOn(data, date) / 1000).toFixed(1)}/${WATER_GOAL_ML / 1000} L`);

    const week = weekView(date, T, moves).map((w) => ({
      d: shortWeekday(w.date)[0],
      s: trained.has(w.date) ? 'done' : w.key === 'rest' ? 'rest' : w.date < date ? 'missed' : 'train',
      today: w.date === date,
    }));

    const base = {
      date,
      streak: i === 0 && streak > 0 ? String(streak) : '',
      tonight: evening && !eveningDone(data, date, evening) ? `Tonight ${times.evening_time} · ${evening.label}` : '',
      meals: meals.map(({ protein: _p, ...m }) => m),
      stats: stats.join(' · '),
      week,
    };
    out.push(
      !next
        ? { ...base, kicker: 'Rest day', title: 'No session this week', subtitle: 'Rest and recover', route: 'plan' }
        : next.isRestToday
        ? { ...base, kicker: 'Rest day', title: `Next: ${next.label}`, subtitle: `${longWeekday(next.onDate)} at ${times.session_time}`, route: 'plan' }
        : {
            ...base,
            kicker: done?.finished_at ? 'Done today ✓' : `Today · ${times.session_time}`,
            title: next.label,
            subtitle: next.focus,
            route: done?.finished_at ? 'plan' : 'workout',
          },
    );
  }
  return out;
}

/** The meal the widget shows at `hhmm`: the first not eaten whose time hasn't
 * passed by more than an hour; null when the day's eating is over. Mirrors
 * TodayWidget.nextMeal() in Java. */
export function nextMeal(meals, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const now = h * 60 + m;
  return meals.find((x) => {
    if (x.done || !x.time) return false;
    const [mh, mm] = x.time.split(':').map(Number);
    return mh * 60 + mm + 60 >= now;
  }) || null;
}
