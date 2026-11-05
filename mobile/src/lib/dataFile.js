// Import and export of the data file (E2-S2). Import accepts the old site's
// Settings > "Download my data" file ("fitness-os-export" v1), this app's
// own backups of any schema up to the current one, and snapshots.
//
// Restores are lossless: every top-level key is kept, including ones this
// version doesn't know, and the result goes through the same migrate() as
// the data on the phone. A file from a newer schema is refused. A broken
// or truncated file is refused before anything is written.
import { seedExercises, defaultSettings } from './data.js';
import { CURRENT_SCHEMA, migrate, NewerSchemaError, schemaOf } from './migrate.js';

export const FILE_FORMAT = 'fitness-os-export';
const LISTS = ['exercises', 'body_logs', 'hydration_logs', 'workouts', 'meal_logs', 'bonus_logs'];
// File-only fields: they describe the file, not the data.
const FILE_KEYS = ['format', 'exported_at', 'saved_at'];

export class ImportError extends Error {}

function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Parse a backup or old-site export into current-schema data. Throws
 * ImportError with a message for the person; never returns partial data. */
export function parseDataFile(text, content) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't complete or isn't valid JSON, so nothing was changed.");
  }
  if (!isObject(raw) || raw.format !== FILE_FORMAT) {
    throw new ImportError('That isn\'t a Fitness OS data file. Use Settings > "Export a backup" in the app (or "Download my data" on the old site).');
  }
  const version = schemaOf(raw);
  if (version > CURRENT_SCHEMA) throw new ImportError(new NewerSchemaError(version).message);
  for (const key of LISTS) {
    if (!Array.isArray(raw[key])) throw new ImportError(`The file is missing its ${key.replace('_', ' ')}, so nothing was changed.`);
  }

  const rest = Object.fromEntries(Object.entries(raw).filter(([k]) => !FILE_KEYS.includes(k)));
  const workouts = raw.workouts.map((w) => ({
    session_key: null,
    started_at: null,
    finished_at: null,
    ...w,
    sets: Array.isArray(w.sets) ? w.sets : [],
    checklist_items: Array.isArray(w.checklist_items) ? w.checklist_items : [],
  }));
  const settings = isObject(raw.settings) ? raw.settings : {};
  const cleaned = {
    ...rest,
    profile: isObject(raw.profile) ? raw.profile : null,
    exercises: seedExercises(content, raw.exercises),
    body_logs: [...raw.body_logs].sort((a, b) => (a.log_date < b.log_date ? -1 : 1)),
    workouts,
    shopping: isObject(raw.shopping) && Array.isArray(raw.shopping.checked) ? raw.shopping : { week: null, checked: [] },
    settings: { ...defaultSettings(), ...settings, modules: { ...defaultSettings().modules, ...(settings.modules || {}) } },
  };
  if (version < 2) cleaned.plan_overrides = isObject(raw.plan_overrides) ? raw.plan_overrides : {};
  return migrate(cleaned, content);
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
  const { version: _v1, saved_at: _saved, ...rest } = data;
  return JSON.stringify({ format: FILE_FORMAT, schemaVersion: schemaOf(data), exported_at: now.toISOString().slice(0, 19) + 'Z', ...rest }, null, 2);
}

/** A snapshot is the raw saved data (no file header): read it like a
 * backup, keeping its own schema version so an old one is upgraded. */
export function parseSnapshot(text, content) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That snapshot isn't complete, so nothing was changed.");
  }
  if (!isObject(raw)) throw new ImportError("That snapshot can't be read.");
  return parseDataFile(JSON.stringify({ ...raw, format: FILE_FORMAT }), content);
}
