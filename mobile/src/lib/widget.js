// What the home-screen widget shows, one entry per date for the coming
// week, so it stays right after midnight without the app running.
import { addDays, longWeekday } from './dates.js';
import * as D from './data.js';
import { programDayFor, sessionKeyOn } from './schedule.js';

export const WIDGET_DAYS = 7;

export function widgetDays(data, content, today) {
  const T = content.training;
  const slots = content.nutrition.meal_slots.length;
  const streak = D.trainingStreak(data, today, (d) => sessionKeyOn(d, T) === 'rest');
  const out = [];
  for (let i = 0; i < WIDGET_DAYS; i += 1) {
    const date = addDays(today, i);
    const next = programDayFor(date, T);
    const done = D.workoutOn(data, date);
    const meals = content.nutrition.meal_slots.filter((s) => D.mealLog(data, date, s)?.completed).length;
    const bits = [];
    if (i === 0 && streak > 0) bits.push(`${streak}-day streak`);
    if (D.moduleOn(data, 'meals')) bits.push(`Meals ${i === 0 ? meals : 0}/${slots}`);
    out.push(
      next.isRestToday
        ? { date, kicker: 'Rest day', title: `Next: ${next.label}`, subtitle: `${longWeekday(next.onDate)} at ${T.session_time}`, footer: bits.join(' · ') }
        : {
            date,
            kicker: done?.finished_at && i === 0 ? 'Done today' : `Today at ${T.session_time}`,
            title: next.label,
            subtitle: next.focus,
            footer: bits.join(' · '),
          },
    );
  }
  return out;
}
