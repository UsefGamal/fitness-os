// Import and export of the data file (E2-S2). Import accepts the old site's
// Settings > "Download my data" file ("fitness-os-export" v1), this app's
// own backups of any schema up to the current one, and snapshots.
//
// Restores are lossless, and the result goes through the same migrate() as
// the data on the phone. A file from a newer schema is refused. A broken
// or truncated file is refused before anything is written.
//
// A file can come from anyone (P14-10, SEC-07), so import also:
// - refuses a file over MAX_FILE_BYTES;
// - moves top-level keys this version doesn't know into an _unknown bag
//   (kept for the next export, never read by the app) and drops keys that
//   could reach an object's prototype;
// - drops progress photo entries whose file isn't a photo in the photos
//   folder, so "Delete photo" can never remove the data file.
import { seedExercises, defaultSettings } from './data.js';
import { CURRENT_SCHEMA, migrate, NewerSchemaError, schemaOf } from './migrate.js';

export const FILE_FORMAT = 'fitness-os-export';
/** "Share a copy" (P14-14): a file to show someone, never to restore. */
export const SHARE_FORMAT = 'fitness-os-share';
const LISTS = ['exercises', 'body_logs', 'hydration_logs', 'workouts', 'meal_logs', 'bonus_logs'];
// File-only fields: they describe the file, not the data.
const FILE_KEYS = ['format', 'exported_at', 'saved_at'];

export class ImportError extends Error {}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Every top-level key the app reads or writes. dataFile.test.js checks that
 * each key the source writes is listed. */
export const DATA_KEYS = new Set([
  'schemaVersion', 'version', 'saved_at', 'profile', 'goals', 'safety', 'diet', 'program', 'checkins',
  'rewards', 'exercises', 'body_logs', 'hydration_logs', 'workouts', 'meal_logs', 'bonus_logs', 'shopping',
  'settings', 'session_moves', 'exercise_notes', 'achievements', 'evening_plan', 'progress_photos',
  'health_daily', 'plan_overrides', 'setup', '_unknown',
]);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** What a shared copy keeps (P14-14, pentest JS-01): the plan, the logged
 * workouts and meals, and nothing about the person. An allow-list, so a new
 * key stays private until it is added here on purpose. */
export const SHARE_KEEPS = new Set([
  'schemaVersion', 'program', 'plan_overrides', 'exercises', 'workouts', 'meal_logs', 'bonus_logs', 'shopping',
  'session_moves', 'exercise_notes', 'achievements', 'rewards', 'evening_plan',
]);
/** Everything a shared copy leaves out: profile (birth date, height), goals,
 * diet, set-up and screening answers, settings, check-ins, weigh-ins and
 * measurements, water, daily health data and photo entries. */
export const SHARE_OMITS = [...DATA_KEYS].filter((k) => !SHARE_KEEPS.has(k));
/** Workout fields a shared copy leaves out: how a session hurt. */
const SHARE_WORKOUT_OMITS = ['pain_note'];

/** A photo file the app itself could have written (store/photos.js). */
export const PHOTO_FILE = /^progress-photos\/[\w-]{1,80}\.jpg$/;

export function isPhotoFile(path) {
  return typeof path === 'string' && PHOTO_FILE.test(path);
}

/** Split the file's keys into known ones and the _unknown bag. */
function sortKeys(raw, trusted) {
  const known = {};
  const bag = isObject(raw._unknown) ? { ...raw._unknown } : {};
  for (const [k, v] of Object.entries(raw)) {
    if (BAD_KEYS.has(k) || k === '_unknown') continue;
    if (trusted || DATA_KEYS.has(k) || FILE_KEYS.includes(k)) known[k] = v;
    else bag[k] = v;
  }
  for (const k of BAD_KEYS) delete bag[k];
  if (Object.keys(bag).length) known._unknown = bag;
  return known;
}

function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Parse a backup or old-site export into current-schema data. Throws
 * ImportError with a message for the person; never returns partial data. */
/** trusted: a snapshot this install wrote, whose keys stay where they are. */
export function parseDataFile(text, content, { trusted = false } = {}) {
  if (typeof text === 'string' && text.length > MAX_FILE_BYTES) {
    throw new ImportError('That file is too big to be a Fitness OS backup (over 10 MB), so nothing was changed.');
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't complete or isn't valid JSON, so nothing was changed.");
  }
  if (isObject(raw) && raw.format === SHARE_FORMAT) {
    throw new ImportError("That's a shared copy without health data, so it can't be restored. Use a full backup (Settings > \"Export a backup\").");
  }
  if (!isObject(raw) || raw.format !== FILE_FORMAT) {
    throw new ImportError('That isn\'t a Fitness OS data file. Use Settings > "Export a backup" in the app (or "Download my data" on the old site).');
  }
  const version = schemaOf(raw);
  if (version < 1) throw new ImportError("That file's version can't be read, so nothing was changed.");
  if (version > CURRENT_SCHEMA) throw new ImportError(new NewerSchemaError(version).message);
  for (const key of LISTS) {
    if (!Array.isArray(raw[key])) throw new ImportError(`The file is missing its ${key.replace('_', ' ')}, so nothing was changed.`);
  }

  raw = sortKeys(raw, trusted);
  // Pentest JS-02: list rows must be records, and an exercise needs a
  // name and an id, or one bad row breaks a screen on every start.
  for (const key of LISTS) raw[key] = raw[key].filter(isObject);
  raw.exercises = raw.exercises
    .filter((e) => typeof e.name === 'string' && e.name.trim() && Number.isFinite(e.id))
    .map((e) => (e.name.length > 120 ? { ...e, name: e.name.slice(0, 120) } : e));
  raw.workouts = raw.workouts.filter((w) => Number.isFinite(w.id));
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
  if (Array.isArray(raw.progress_photos)) {
    cleaned.progress_photos = raw.progress_photos.filter((ph) => isObject(ph) && isPhotoFile(ph.file));
  }
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

/** A copy to share (P14-14): the plan, workouts and meals without the
 * health data in SHARE_OMITS, marked so import refuses it. The full backup
 * (toDataFile) is unchanged. */
export function toShareCopy(data, now = new Date()) {
  const rest = {};
  for (const [k, v] of Object.entries(data)) if (SHARE_KEEPS.has(k)) rest[k] = v;
  if (Array.isArray(rest.workouts)) {
    rest.workouts = rest.workouts.map((w) => {
      const out = { ...w };
      for (const k of SHARE_WORKOUT_OMITS) delete out[k];
      return out;
    });
  }
  return JSON.stringify({
    format: SHARE_FORMAT,
    restorable: false,
    note: "A copy to share, without health data. It can't be restored.",
    schemaVersion: schemaOf(data),
    exported_at: now.toISOString().slice(0, 19) + 'Z',
    ...rest,
  }, null, 2);
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
  return parseDataFile(JSON.stringify({ ...raw, format: FILE_FORMAT }), content, { trusted: true });
}

// ── Safety gates on import (P14-10) ───────────────────────────────────

/** The safety limits this phone has on that the file would turn off, e.g.
 * ['no_deficit']. Hiding calories or weight counts too. Empty when nothing loosens. */
export function loosenedGates(current, incoming) {
  const now = current?.safety || {};
  const next = incoming?.safety || {};
  const out = Object.keys(now.gates || {}).filter((k) => now.gates[k] === true && next.gates?.[k] !== true);
  for (const k of ['hide_kcal', 'hide_weight']) if (now[k] === true && next[k] !== true) out.push(k);
  return out;
}

/** The incoming data with this phone's safety answers kept, for "Yes, these
 * are still true". */
export function keepSafety(current, incoming) {
  return { ...incoming, safety: current.safety };
}
