// Which reminders to schedule, as plain data (reminders.test.js). The
// native scheduling itself is in store/notify.js.
import { addDays, fromISO, weekdayName } from './dates.js';
import { eveningOption } from './evening.js';
import { defaultTimes, shiftTime } from './times.js';
import { slotLabel } from './meals.js';
import { programDayFor, sessionKeyOn } from './schedule.js';

export const DAYS_AHEAD = 14;

function at(iso, hhmm, lead = 0) {
  const { time, dayShift } = shiftTime(hhmm, -lead);
  const [h, m] = time.split(':').map(Number);
  const d = fromISO(addDays(iso, dayShift));
  d.setHours(h, m, 0, 0);
  return d;
}

/** Each reminder: { id, at, title, body, route } where `route` is the
 * screen a tap opens. `evening` is data.evening_plan ({ weekday: option key }); `times` is
 * lib/times.js timesOf() (defaults when left out). */
export function plannedReminders(today, content, now = new Date(), moves = [], evening = {}, times = defaultTimes(content)) {
  const out = [];
  const { training, nutrition } = content;
  const lead = times.remind_before;
  const when = (t) => (lead ? `${t}, in ${lead} min` : `Now, ${t}`);
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const day = addDays(today, i);
    if (times.remind_workouts !== false && sessionKeyOn(day, training, moves) !== 'rest') {
      const session = programDayFor(day, training, moves);
      if (session) out.push({
        id: 1000 + i,
        at: at(day, times.session_time, lead),
        title: `${session.label} at ${times.session_time}`,
        body: `${when(times.session_time)} · ${session.focus}`,
        route: '/workout',
      });
    }
    const night = times.remind_evening !== false ? eveningOption(evening?.[weekdayName(day)]) : null;
    if (night) out.push({ id: 3000 + i, at: at(day, times.evening_time, lead), title: `${night.label} at ${times.evening_time}`, body: `${when(times.evening_time)} · ${night.note}`, route: night.route });
    if (times.remind_meals !== false) {
      nutrition.meal_slots.forEach((slot, j) => {
        const start = times.meal_times?.[slot] || nutrition.meal_slot_windows[slot].split('–')[0];
        out.push({ id: 2000 + i * 10 + j, at: at(day, start), title: slotLabel(slot), body: 'Time to eat. Tap to see today’s meal.', route: '/meals' });
      });
    }
  }
  return out.filter((r) => r.at > now);
}
