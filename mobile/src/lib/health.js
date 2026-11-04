// Health Connect, as plain data (health.test.js); the native calls are in
// store/native.js.
import { fromISO, toISO } from './dates.js';
import * as D from './data.js';

// How each session type is written to Health Connect.
const KIND = { gym: 'strength', home: 'calisthenics', recovery: 'stretching', cardio: 'walking', padel: 'other' };

/** Add weigh-ins from Health Connect for dates the app has none for (the
 * app's own entries always win). Uses the last reading of each day. */
export function mergeWeighIns(data, weights) {
  const have = new Set(data.body_logs.map((b) => b.log_date));
  const byDate = new Map();
  for (const w of [...weights].sort((a, b) => a.time - b.time)) {
    if (!(w.kg > 20 && w.kg < 400)) continue;
    byDate.set(toISO(new Date(w.time)), Math.round(w.kg * 10) / 10);
  }
  let out = data;
  let added = 0;
  for (const [log_date, weight_kg] of byDate) {
    if (have.has(log_date)) continue;
    out = D.logBody(out, { log_date, weight_kg, notes: 'From Health Connect' });
    added += 1;
  }
  return { data: out, added };
}

/** Finished workouts as Health Connect exercise sessions. */
export function healthWorkouts(data, sessionTime = '07:00') {
  const [h, m] = sessionTime.split(':').map(Number);
  return data.workouts
    // Imported history (Strong, Hevy) came from apps that write their own.
    .filter((w) => !w.imported && (w.finished_at || w.sets.length || w.checklist_items?.length || w.duration_min))
    .map((w) => {
      let start = w.started_at;
      if (!start) {
        const d = fromISO(w.log_date);
        d.setHours(h, m, 0, 0);
        start = d.getTime();
      }
      // Only a guided workout has real start and end times; a logged session's
      // finished_at is when it was saved, so it gets its duration instead.
      const end = w.started_at && w.finished_at > start ? w.finished_at : start + (w.duration_min || 60) * 60000;
      const n = w.sets.length;
      const sets = n ? `${n} set${n === 1 ? '' : 's'}` : '';
      return { id: w.id, start, end, title: w.notes || w.workout_type, kind: KIND[w.workout_type] || 'other', notes: sets, version: w.finished_at || end };
    });
}
