// Which reminders to schedule, as plain data (reminders.test.js). The
// native scheduling itself is in store/notify.js.
import { addDays, fromISO, weekdayName } from './dates.js';
import { EVENING_TIME, eveningOption } from './evening.js';
import { slotLabel } from './meals.js';
import { programDayFor, sessionKeyOn } from './schedule.js';

export const DAYS_AHEAD = 14;

function at(iso, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromISO(iso);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 'h:mm' 30 minutes before a 'HH:MM' time. */
function minus30(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m - 30;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** `evening` is data.evening_plan ({ weekday: option key }). */
export function plannedReminders(today, content, now = new Date(), moves = [], evening = {}) {
  const out = [];
  const { training, nutrition } = content;
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const day = addDays(today, i);
    if (sessionKeyOn(day, training, moves) !== 'rest') {
      const session = programDayFor(day, training, moves);
      out.push({
        id: 1000 + i,
        at: at(day, minus30(training.session_time)),
        title: `${session.label} at ${training.session_time}`,
        body: session.focus,
      });
    }
    const night = eveningOption(evening?.[weekdayName(day)]);
    if (night) out.push({ id: 3000 + i, at: at(day, minus30(EVENING_TIME)), title: `${night.label} at ${EVENING_TIME}`, body: night.note });
    nutrition.meal_slots.forEach((slot, j) => {
      const start = nutrition.meal_slot_windows[slot].split('–')[0];
      out.push({ id: 2000 + i * 10 + j, at: at(day, start), title: slotLabel(slot), body: 'Time to eat. Tap to see today’s meal.' });
    });
  }
  return out.filter((r) => r.at > now);
}
