// Workout CSV: export every set as one row, and import a Strong or Hevy
// export (or our own) with a preview before anything is saved. Pure
// helpers, tested in csv.test.js.
import { addCustomExercise, nextId } from './data.js';

export const CSV_HEADER = ['date', 'workout', 'exercise', 'muscle_group', 'set', 'weight_kg', 'reps', 'rpe'];
const LB = 0.45359237;

function cell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per logged set, oldest first. */
export function toCsv(data) {
  const ex = new Map(data.exercises.map((e) => [e.id, e]));
  const rows = [CSV_HEADER];
  const workouts = [...data.workouts].sort((a, b) => (a.log_date === b.log_date ? a.id - b.id : a.log_date < b.log_date ? -1 : 1));
  for (const w of workouts) {
    for (const s of w.sets) {
      const e = ex.get(s.exercise_id);
      rows.push([w.log_date, w.notes || w.workout_type, e?.name || 'Exercise', e?.muscle_group || '', s.set_number, s.weight_kg ?? '', s.reps ?? '', s.rpe ?? '']);
    }
  }
  return rowsToCsv(rows);
}

const rowsToCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';

/** Weigh-ins and measurements, one row per day. */
export function bodyCsv(data) {
  const cols = ['date', 'weight_kg', 'waist_cm', 'chest_cm', 'arm_cm', 'hips_cm', 'thigh_cm', 'sleep_hours'];
  return rowsToCsv([cols, ...data.body_logs.map((b) => [b.log_date, ...cols.slice(1).map((c) => b[c] ?? '')])]);
}

/** Meal ticks, one row per meal slot logged. */
export function mealsCsv(data) {
  const rows = [...(data.meal_logs || [])].sort((a, b) => (a.log_date < b.log_date ? -1 : 1));
  return rowsToCsv([['date', 'meal', 'eaten', 'option', 'drink'], ...rows.map((m) => [m.log_date, m.meal_slot, m.completed ? 'yes' : 'no', m.option_key ?? '', m.drink_key ?? ''])]);
}

/** RFC 4180 parsing with a guessed delimiter (Strong uses ";" in some locales). */
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** 'YYYY-MM-DD' from '2024-03-05 07:10:00', '2024-03-05T07:10' or Hevy's
 * '5 Mar 2024, 07:10'. Null when unreadable. */
export function csvDate(s) {
  const t = (s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const num = (s) => {
  const v = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// Column names per source app; the first that matches the header wins.
const SOURCES = [
  { key: 'fitness-os', label: 'Fitness OS', needs: ['date', 'exercise', 'weight_kg', 'reps'], date: 'date', workout: 'workout', exercise: 'exercise', weight: 'weight_kg', reps: 'reps', rpe: 'rpe', kg: true },
  { key: 'hevy', label: 'Hevy', needs: ['start_time', 'exercise_title', 'reps'], date: 'start_time', workout: 'title', exercise: 'exercise_title', weight: 'weight_kg', weightLb: 'weight_lbs', reps: 'reps', rpe: 'rpe', type: 'set_type', kg: true },
  { key: 'strong', label: 'Strong', needs: ['Date', 'Exercise Name', 'Reps'], date: 'Date', workout: 'Workout Name', exercise: 'Exercise Name', weight: 'Weight', reps: 'Reps', rpe: 'RPE', order: 'Set Order', kg: false },
];

/** Read a workout CSV into { source, workouts: [{ date, label, sets:
 * [{ exercise, weightKg, reps, rpe }] }], skipped }. Strong doesn't say its
 * unit, so `unit` ('kg' | 'lb') applies to it. Warm-up sets are left out. */
export function readWorkoutCsv(text, { unit = 'kg' } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('That file has no rows.');
  const head = rows[0].map((h) => h.trim());
  const src = SOURCES.find((s) => s.needs.every((n) => head.includes(n)));
  if (!src) throw new Error('Unknown CSV. Export from Strong, Hevy or this app and try again.');
  const col = (name) => head.indexOf(name);
  const at = (r, name) => (name && col(name) >= 0 ? r[col(name)] : undefined);
  const groups = new Map();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = csvDate(at(r, src.date));
    const exercise = (at(r, src.exercise) || '').trim();
    const reps = num(at(r, src.reps));
    const setType = (at(r, src.type) || '').toLowerCase();
    const order = (at(r, src.order) || '').trim().toUpperCase();
    if (!date || !exercise || !(reps > 0) || setType === 'warmup' || order === 'W' || order === 'REST TIMER') {
      skipped += 1;
      continue;
    }
    let weight = num(at(r, src.weight));
    if (weight == null && src.weightLb) weight = num(at(r, src.weightLb)) == null ? null : num(at(r, src.weightLb)) * LB;
    else if (!src.kg && unit === 'lb' && weight != null) weight *= LB;
    const label = (at(r, src.workout) || 'Imported workout').trim() || 'Imported workout';
    const key = `${date}|${label}`;
    if (!groups.has(key)) groups.set(key, { date, label, sets: [] });
    const rpe = num(at(r, src.rpe));
    groups.get(key).sets.push({ exercise, weightKg: weight == null ? 0 : Math.round(weight * 100) / 100, reps: Math.round(reps), rpe: rpe || null });
  }
  const workouts = [...groups.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { source: src.label, workouts, skipped };
}

const GUESS = [
  ['Chest', /bench|chest|fly|flye|pec|push.?up|dip/i],
  ['Back', /row|pull|lat|chin|deadlift|back|shrug/i],
  ['Shoulders', /shoulder|overhead|military|lateral|delt|face pull|press.*arnold|arnold/i],
  ['Arms', /curl|tricep|bicep|skull|pushdown|extension|hammer/i],
  ['Legs', /squat|leg|lunge|calf|glute|hip thrust|hamstring|quad|step.?up/i],
  ['Core', /plank|crunch|ab|sit.?up|oblique|core|twist|hollow/i],
];

/** A best guess at the app group for a new exercise name. */
export function guessGroup(name) {
  for (const [g, re] of GUESS) if (re.test(name)) return g;
  return 'Core';
}

/** What an import would do: new workouts, duplicates skipped, new exercises. */
export function previewImport(data, parsed) {
  const have = new Set(data.workouts.map((w) => `${w.log_date}|${(w.notes || '').toLowerCase()}`));
  const known = new Set(data.exercises.map((e) => e.name.toLowerCase()));
  const fresh = parsed.workouts.filter((w) => !have.has(`${w.date}|${w.label.toLowerCase()}`));
  const newExercises = [...new Set(fresh.flatMap((w) => w.sets.map((s) => s.exercise)))].filter((n) => !known.has(n.toLowerCase()));
  return {
    workouts: fresh,
    duplicates: parsed.workouts.length - fresh.length,
    sets: fresh.reduce((n, w) => n + w.sets.length, 0),
    newExercises,
    from: fresh[0]?.date || null,
    to: fresh[fresh.length - 1]?.date || null,
  };
}

/** Add the previewed workouts as finished gym workouts. Existing data is
 * never changed; unknown exercises are added as custom ones. */
export function applyImport(data, preview) {
  let out = data;
  for (const name of preview.newExercises) out = addCustomExercise(out, { name, muscle_group: guessGroup(name) });
  const idOf = new Map(out.exercises.map((e) => [e.name.toLowerCase(), e.id]));
  let wid = nextId(out.workouts);
  let sid = nextId(out.workouts.flatMap((w) => w.sets));
  const added = preview.workouts.map((w) => {
    const counts = new Map();
    const sets = w.sets.map((s) => {
      const exerciseId = idOf.get(s.exercise.toLowerCase());
      const n = (counts.get(exerciseId) || 0) + 1;
      counts.set(exerciseId, n);
      return { id: sid++, exercise_id: exerciseId, set_number: n, reps: s.reps, weight_kg: s.weightKg, rpe: s.rpe };
    });
    return {
      id: wid++, log_date: w.date, workout_type: 'gym', duration_min: null, notes: w.label, session_rpe: null, is_deload: false,
      pain_note: null, result: null, session_key: null, started_at: null, finished_at: null, imported: true, sets, checklist_items: [],
    };
  });
  return { ...out, workouts: [...out.workouts, ...added] };
}
