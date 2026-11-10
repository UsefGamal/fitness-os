// "Add to calendar" on the Plan page: one session as an .ics event
// (RFC 5545). Floating local time, so it lands at 07:00 on the phone
// whatever the time zone. Pure, tested in calendar.test.js.

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines over 75 octets (RFC 5545 3.1); ASCII-safe approximation. */
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join('\r\n');
}

const stamp = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

function addMinutes(date, time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m + minutes);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** { date: 'YYYY-MM-DD', time: 'HH:MM', minutes, title, description, now: Date } -> .ics text. */
export function sessionIcs({ date, time, minutes = 60, title, description = '', now = new Date() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('bad date or time');
  const end = addMinutes(date, time, minutes);
  const dtstamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fitness OS//Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:fitness-os-${date}-${time.replace(':', '')}@fitness-os.local`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${stamp(date, time)}`,
    `DTEND:${stamp(end.date, end.time)}`,
    `SUMMARY:${esc(title)}`,
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Rough session length: about 3 minutes a working set plus the warm-up
 * and any cardio after, rounded up to 15 minutes. */
export function sessionMinutes(day) {
  if (!day) return 60;
  const sets = (day.exercises || []).reduce((n, e) => n + (Number(e.sets) || 0), 0);
  const total = sets * 3 + 10 + (day.cardio_after?.minutes || 0);
  return Math.max(30, Math.ceil(total / 15) * 15);
}
