// Which reminders to schedule, as plain data (reminders.test.js). The
// native scheduling itself is in store/notify.js.
import { addDays, fromISO, weekdayName } from './dates.js';
import { eveningOption } from './evening.js';
import { defaultTimes, shiftTime } from './times.js';
import { slotLabel } from './meals.js';
import { programDayFor, sessionKeyOn } from './schedule.js';
import { t } from './i18n.js';

export const DAYS_AHEAD = 14;

function at(iso, hhmm, lead = 0) {
  const { time, dayShift } = shiftTime(hhmm, -lead);
  const [h, m] = time.split(':').map(Number);
  const d = fromISO(addDays(iso, dayShift));
  d.setHours(h, m, 0, 0);
  return d;
}

/** What is already logged, so a done day gets no reminder (P14-12):
 * { workouts: Set of dates with a finished workout, meals: Set of
 * "date|slot" with a completed meal }. */
export function doneFrom(data) {
  return {
    workouts: new Set((data?.workouts || []).filter((w) => w.finished_at && w.log_date).map((w) => w.log_date)),
    meals: new Set((data?.meal_logs || []).filter((m) => m.completed).map((m) => `${m.log_date}|${m.meal_slot}`)),
  };
}

/** Each reminder: { id, at, title, body, route } where `route` is the
 * screen a tap opens. `evening` is data.evening_plan ({ weekday: option key }); `times` is
 * lib/times.js timesOf() (defaults when left out); `done` is doneFrom(data). */
export function plannedReminders(today, content, now = new Date(), moves = [], evening = {}, times = defaultTimes(content), done = {}) {
  const out = [];
  const { training, nutrition } = content;
  const lead = times.remind_before;
  const when = (time) => (lead ? t('remind.inMin', { time, min: lead }) : t('remind.now', { time }));
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const day = addDays(today, i);
    if (times.remind_workouts !== false && sessionKeyOn(day, training, moves) !== 'rest' && !done.workouts?.has(day)) {
      const session = programDayFor(day, training, moves);
      if (session) out.push({
        id: 1000 + i,
        at: at(day, times.session_time, lead),
        title: t('remind.at', { what: session.label, time: times.session_time }),
        body: `${when(times.session_time)} · ${session.focus}`,
        route: '/workout',
      });
    }
    const night = times.remind_evening !== false ? eveningOption(evening?.[weekdayName(day)]) : null;
    if (night) out.push({ id: 3000 + i, at: at(day, times.evening_time, lead), title: t('remind.at', { what: night.label, time: times.evening_time }), body: `${when(times.evening_time)} · ${night.note}`, route: night.route });
    if (times.remind_meals === true) {
      nutrition.meal_slots.forEach((slot, j) => {
        if (done.meals?.has(`${day}|${slot}`)) return;
        const start = times.meal_times?.[slot] || nutrition.meal_slot_windows[slot].split('–')[0];
        out.push({ id: 2000 + i * 10 + j, at: at(day, start), title: slotLabel(slot), body: t('remind.meal'), route: '/meals' });
      });
    }
  }
  return out.filter((r) => r.at > now);
}
