// Which reminders to schedule, as plain data (reminders.test.js). The
// native scheduling itself is in store/notify.js.
import { addDays, fromISO } from './dates.js';
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

export function plannedReminders(today, content, now = new Date()) {
  const out = [];
  const { training, nutrition } = content;
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const day = addDays(today, i);
    if (sessionKeyOn(day, training) !== 'rest') {
      const session = programDayFor(day, training);
      out.push({
        id: 1000 + i,
        at: at(day, minus30(training.session_time)),
        title: `${session.label} at ${training.session_time}`,
        body: session.focus,
      });
    }
    nutrition.meal_slots.forEach((slot, j) => {
      const start = nutrition.meal_slot_windows[slot].split('–')[0];
      out.push({ id: 2000 + i * 10 + j, at: at(day, start), title: slotLabel(slot), body: 'Time to eat. Tap to see today’s meal.' });
    });
  }
  return out.filter((r) => r.at > now);
}
