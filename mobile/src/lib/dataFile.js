// Import and export of the data file. Import accepts the old site's
// Settings > "Download my data" file (format "fitness-os-export", v1) and
// this app's own backups (the same format).
import { DATA_VERSION, defaultSettings, seedExercises } from './data.js';

export const FILE_FORMAT = 'fitness-os-export';
const LISTS = ['exercises', 'body_logs', 'hydration_logs', 'workouts', 'meal_logs', 'bonus_logs'];

export class ImportError extends Error {}

export function parseDataFile(text, content) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid JSON.");
  }
  if (!raw || raw.format !== FILE_FORMAT) {
    throw new ImportError('That isn\'t a Fitness OS data file. Use Settings > "Download my data" on the old site.');
  }
  if (raw.version !== 1) throw new ImportError(`This file is version ${raw.version}; this app reads version 1.`);
  for (const key of LISTS) {
    if (!Array.isArray(raw[key])) throw new ImportError(`The file is missing its ${key.replace('_', ' ')}.`);
  }
  const workouts = raw.workouts.map((w) => ({
    session_key: null,
    started_at: null,
    finished_at: null,
    ...w,
    sets: Array.isArray(w.sets) ? w.sets : [],
    checklist_items: Array.isArray(w.checklist_items) ? w.checklist_items : [],
  }));
  return {
    version: DATA_VERSION,
    profile: raw.profile || null,
    exercises: seedExercises(content, raw.exercises),
    body_logs: [...raw.body_logs].sort((a, b) => (a.log_date < b.log_date ? -1 : 1)),
    hydration_logs: raw.hydration_logs,
    workouts,
    meal_logs: raw.meal_logs,
    bonus_logs: raw.bonus_logs,
    plan_overrides: raw.plan_overrides && typeof raw.plan_overrides === 'object' ? raw.plan_overrides : {},
    shopping: raw.shopping && Array.isArray(raw.shopping.checked) ? raw.shopping : { week: null, checked: [] },
    // Added later, all optional: a missing one is left out, not defaulted.
    ...(Array.isArray(raw.session_moves) ? { session_moves: raw.session_moves } : {}),
    ...(raw.exercise_notes && typeof raw.exercise_notes === 'object' ? { exercise_notes: raw.exercise_notes } : {}),
    ...(raw.achievements && typeof raw.achievements === 'object' ? { achievements: raw.achievements } : {}),
    ...(raw.evening_plan && typeof raw.evening_plan === 'object' ? { evening_plan: raw.evening_plan } : {}),
    // The photo list only; the images stay on the phone that took them.
    ...(Array.isArray(raw.progress_photos) ? { progress_photos: raw.progress_photos } : {}),
    ...(raw.health_daily && typeof raw.health_daily === 'object' ? { health_daily: raw.health_daily } : {}),
    settings: { ...defaultSettings(), ...(raw.settings || {}), modules: { ...defaultSettings().modules, ...(raw.settings?.modules || {}) } },
  };
}

export function summarize(data) {
  return {
    weighIns: data.body_logs.length,
    workouts: data.workouts.length,
    sets: data.workouts.reduce((n, w) => n + w.sets.length, 0),
    meals: data.meal_logs.filter((m) => m.completed).length,
  };
}

export function toDataFile(data, now = new Date()) {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, exported_at: now.toISOString().slice(0, 19) + 'Z', ...data }, null, 2);
}
