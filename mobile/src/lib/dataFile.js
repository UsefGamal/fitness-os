// Import and export of the data file. Import accepts the old site's
// Settings > "Download my data" file (format "fitness-os-export", v1) and
// this app's own backups (the same format).
import { DATA_VERSION, seedExercises } from './data.js';

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
    settings: { notifications: false, ...(raw.settings || {}) },
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
