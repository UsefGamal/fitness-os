// The bundled exercise catalogue (free-exercise-db, public domain), built by
// scripts/fetch_exercise_photos.py into public/exercise-db/. Pure helpers;
// the loader lives in store/catalogue.js.

import { ANGLES, angleOf, musclesOf } from './muscles.js';

// The dataset's muscles folded into the app's six groups (Library, BodyMap).
export const MUSCLE_GROUP = {
  chest: 'Chest',
  lats: 'Back', 'middle back': 'Back', 'lower back': 'Back', traps: 'Back',
  shoulders: 'Shoulders', neck: 'Shoulders',
  biceps: 'Arms', triceps: 'Arms', forearms: 'Arms',
  quadriceps: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs', adductors: 'Legs', abductors: 'Legs',
  abdominals: 'Core',
};

export function groupOf(entry) {
  return MUSCLE_GROUP[entry.primary[0]] || 'Core';
}

export function groupsOf(entry) {
  return new Set([...entry.primary, ...entry.secondary].map((m) => MUSCLE_GROUP[m]).filter(Boolean));
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Search by name, muscle group and equipment. Every word of the query must appear. */
export function filterCatalogue(entries, { q = '', group = null, equipment = null, muscle = null, angle = null } = {}) {
  const words = norm(q).split(' ').filter(Boolean);
  return entries.filter((e) => {
    if (group && groupOf(e) !== group) return false;
    if (equipment && (e.equipment || 'other') !== equipment) return false;
    if (muscle && !musclesOf(e).includes(muscle)) return false;
    if (angle && angleOf(e) !== angle) return false;
    const a = angleOf(e);
    const hay = norm(`${e.name} ${e.primary.join(' ')} ${musclesOf(e).join(' ')} ${a ? ANGLES[a].label : ''} ${e.equipment || ''}`);
    return words.every((w) => hay.includes(w));
  });
}

/** The catalogue entry whose photos show one of our exercises: the curated
 * mapping in content/exercise_photos.py first, then an exact name match. */
export function entryFor(name, training, byId) {
  const id = training.exercise_photos?.[name];
  if (id && byId.has(id)) return byId.get(id);
  const n = norm(name);
  for (const e of byId.values()) if (norm(e.name) === n) return e;
  return null;
}

/** The small list-row image: the thumbnail when the build made one. */
export function thumbOf(entry) {
  return entry?.thumb || entry?.photos?.[0] || null;
}

/** The URL of a bundled photo: catalogue paths are relative to exercise-db/. */
export function photoSrc(path) {
  return path ? `exercise-db/${path}` : null;
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
