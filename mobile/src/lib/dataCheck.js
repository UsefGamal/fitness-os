// The data check (PROOF-1): one short line a person can read out before and
// after an update, "W 132 · S 2,410 · M 318 · B 61 · 3F9A-12CD". The counts
// are workouts, sets, meals eaten and weigh-ins; the last part is a hash of
// what the person has logged. Same line before and after means the update
// kept the data. Nothing here leaves the phone unless the person sends a
// bug report, and the hash can't be turned back into data.
//
// The hash must not move by itself, so it leaves out:
//   - whole keys that change without the person doing anything (SKIP);
//   - fields the app works out and fills in later (DERIVED), such as the
//     numbers copied onto a ticked meal;
//   - empty values (null, false, '', [], {}), so an upgrade that adds a
//     field with an empty default changes nothing.
// An upgrade that adds a field with a non-empty default must add it to
// DERIVED in the same change, or the update test (scripts/
// update-over-install.sh) will rightly fail.
//
// Pure; dataCheck.test.js.
import { isSetDefault, SET_FIELDS } from './sets.js';
import { summarize } from './dataFile.js';

/** Top-level keys left out of the hash. */
export const SKIP = ['saved_at', 'settings', 'health_daily', '_unknown', 'achievements', 'schemaVersion', 'version', 'format', 'exported_at'];

/** Worked-out fields left out, per top-level collection. */
export const DERIVED = { meal_logs: ['eaten'] };

const isEmpty = (v) => v == null || v === false || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

/** A value with keys sorted, empty values dropped and `drop` keys removed
 * at every level. Arrays keep their order. */
export function canonical(value, drop = []) {
  if (Array.isArray(value)) return value.map((v) => canonical(v, drop));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (drop.includes(k)) continue;
      const v = canonical(value[k], drop);
      if (!isEmpty(v)) out[k] = v;
    }
    return out;
  }
  return value;
}

/** FNV-1a, 32 bits, over the UTF-8 bytes. A change detector, not security. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Sets without any version 3 field (lib/sets.js) that is at its
 * default: set_type 'work' (or 'warmup' on a warm-up), track 'load', the
 * rest null. Rule: a set field at its documented default does not count.
 * So the code is the same before and after the upgrade from version 2,
 * the same whether a default is written out or left off, and it changes
 * as soon as someone logs a real drop set, a superset or a timed set. */
export function withoutSetDefaults(workouts) {
  if (!Array.isArray(workouts)) return workouts;
  return workouts.map((w) => (!w || !Array.isArray(w.sets) ? w : {
    ...w,
    sets: w.sets.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const out = { ...s };
      for (const k of SET_FIELDS) if (k in out && isSetDefault(s, k)) delete out[k];
      return out;
    }),
  }));
}

/** The data's hash as "3F9A-12CD". */
export function dataHash(data) {
  // Keys from a newer build ride in `_unknown` after an import (lib/
  // dataFile.js) and at the top level before it: count them the same.
  const flat = { ...(data?._unknown || {}), ...(data || {}) };
  const kept = {};
  for (const k of Object.keys(flat).sort()) {
    if (SKIP.includes(k)) continue;
    const v = canonical(k === 'workouts' ? withoutSetDefaults(flat[k]) : flat[k], DERIVED[k] || []);
    if (!isEmpty(v)) kept[k] = v;
  }
  const hex = fnv1a(JSON.stringify(kept)).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** { workouts, sets, meals, weighIns }: the same counts a backup's preview shows. */
export function checkCounts(data) {
  return summarize({ workouts: [], meal_logs: [], body_logs: [], ...(data || {}) });
}

const n = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "W 132 · S 2,410 · M 318 · B 61 · 3F9A-12CD" */
export function checkLine(data) {
  const c = checkCounts(data);
  return `W ${n(c.workouts)} · S ${n(c.sets)} · M ${n(c.meals)} · B ${n(c.weighIns)} · ${dataHash(data)}`;
}

/** Did a different app version last open this data? Then a snapshot is
 * kept before anything else happens. Never for dev builds, and never for
 * data no version has stamped yet when it is still empty. */
export function versionChanged(data, appVersion) {
  if (!appVersion || appVersion === 'dev') return false;
  const last = data?.settings?.app_version;
  if (last === appVersion) return false;
  if (!last) return checkCounts(data).workouts + checkCounts(data).meals + checkCounts(data).weighIns > 0;
  return true;
}

/** Record which app version opened the data. Same object when unchanged. */
export function stampVersion(data, appVersion) {
  if (!appVersion || appVersion === 'dev' || data?.settings?.app_version === appVersion) return data;
  return { ...data, settings: { ...(data.settings || {}), app_version: appVersion } };
}

/** The one line the app writes to the phone's log at start, which the
 * update test reads: "OK <version> <check line>" or "ERROR <version> <kind>". */
export function startLine({ version, data = null, error = null }) {
  return error ? `ERROR ${version} ${error}` : `OK ${version} ${checkLine(data)}`;
}

/** Read a start line back: { ok, version, line } or null. */
export function parseStartLine(text) {
  const m = /^(OK|ERROR) (\S+) (.+)$/.exec(String(text || '').trim());
  return m ? { ok: m[1] === 'OK', version: m[2], line: m[3] } : null;
}
