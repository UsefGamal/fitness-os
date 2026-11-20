// The 16 main muscle groups (BeFit item 17, 19 Nov 2026): what the
// Library, Swap, Stats' map and recovery show. Each group holds one or
// more of the finer muscles in muscles.js (the deltoid heads stay apart
// under Shoulders, lats and middle back under Back), so an exercise's
// main muscles and helpers, and every set already logged, fold into these
// groups when they are read: nothing stored changes. Pure helpers.
import { hardSetValue } from './data.js';
import { addDays, daysBetween } from './dates.js';
import { MUSCLE, targetFor } from './muscles.js';

export const GROUPS16 = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'middle back'] },
  { key: 'traps', label: 'Trapezius', muscles: ['traps', 'neck'] },
  { key: 'lower_back', label: 'Lower back', muscles: ['lower back'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['front delts', 'side delts', 'rear delts', 'rotator cuff'] },
  { key: 'biceps', label: 'Biceps', muscles: ['biceps'] },
  { key: 'triceps', label: 'Triceps', muscles: ['triceps'] },
  { key: 'forearms', label: 'Forearms', muscles: ['forearms'] },
  { key: 'abs', label: 'Abs', muscles: ['abdominals'] },
  { key: 'obliques', label: 'Obliques', muscles: ['obliques'] },
  { key: 'quads', label: 'Quads', muscles: ['quadriceps', 'hip flexors'] },
  { key: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'] },
  { key: 'glutes', label: 'Glutes', muscles: ['glutes'] },
  { key: 'calves', label: 'Calves', muscles: ['calves', 'shins'] },
  { key: 'abductors', label: 'Abductors', muscles: ['abductors'] },
  { key: 'adductors', label: 'Adductors', muscles: ['adductors'] },
];

export const GROUP16 = Object.fromEntries(GROUPS16.map((g) => [g.key, g]));

const OF_MUSCLE = Object.fromEntries(GROUPS16.flatMap((g) => g.muscles.map((m) => [m, g.key])));
// The catalogue's own "shoulders" (before the head is worked out).
OF_MUSCLE.shoulders = 'shoulders';

/** The group a muscle (muscles.js key, or a catalogue tag) belongs to. */
export function groupOfMuscle(m) {
  return OF_MUSCLE[m] || null;
}

/** Each body-map outline in exactly one group, for colouring and taps. */
export const GROUP_OF_OUTLINE = {
  chest: 'chest',
  lats: 'back', 'upper-back': 'back',
  trapezius: 'traps', 'trapezius-mid': 'traps', neck: 'traps',
  'lower-back': 'lower_back',
  'front-deltoids': 'shoulders', 'back-deltoids': 'shoulders',
  'biceps-long': 'biceps', 'biceps-short': 'biceps',
  'triceps-long': 'triceps', 'triceps-lateral': 'triceps',
  forearm: 'forearms',
  abs: 'abs', obliques: 'obliques',
  quadriceps: 'quads', hamstring: 'hamstrings', gluteal: 'glutes',
  calves: 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves',
  // The drawing's 'abductors' outline is on the inner thigh.
  'hip-abductor': 'abductors', abductors: 'adductors', adductor: 'adductors',
};

/** The outlines of a group. */
export function outlinesOf(key) {
  return Object.keys(GROUP_OF_OUTLINE).filter((o) => GROUP_OF_OUTLINE[o] === key);
}

/** Main and helper groups of a target ({ main, helpers } muscles); a group
 * that is already a main one isn't a helper too. */
export function groupsOfTarget(target) {
  if (!target) return { main: [], helpers: [] };
  const main = [...new Set((target.main || []).map(groupOfMuscle).filter(Boolean))];
  const helpers = [...new Set((target.helpers || []).map(groupOfMuscle).filter(Boolean))].filter((g) => !main.includes(g));
  return { main, helpers };
}

// An exercise someone added themselves, with only the app's six groups.
const OLD_GROUP = { Chest: ['chest'], Back: ['back'], Shoulders: ['shoulders'], Arms: ['biceps', 'triceps'], Legs: ['quads', 'hamstrings', 'glutes'], Core: ['abs'] };

/** Main and helper groups of one of the person's exercises: the
 * hand-checked table, then the catalogue entry, then its old group. */
export function exerciseGroups(exercise, training, entry = null) {
  const target = exercise ? targetFor(exercise.name, training, entry) : null;
  if (target && target.main.length) return groupsOfTarget(target);
  return { main: OLD_GROUP[exercise?.muscle_group] || [], helpers: [] };
}

/** The groups a logged set of this exercise trains: a stretch (by its
 * catalogue entry, when the hand-checked table doesn't know it) trains
 * none, so it never counts toward weekly sets or recovery. */
export function trainedGroups(exercise, training, entry = null) {
  if (entry?.category === 'stretching' && !training?.exercise_targets?.[exercise?.name]) return { main: [], helpers: [] };
  return exerciseGroups(exercise, training, entry);
}

/** Does a catalogue entry (or target) mainly work this group? `muscle`
 * narrows to one muscle of it. */
export function inGroup(target, key, muscle = null) {
  const main = target?.main || [];
  if (muscle) return main.includes(muscle);
  return main.some((m) => groupOfMuscle(m) === key);
}

/** How many entries mainly work each group: { key: n }. */
export function countByGroup(targets) {
  const out = Object.fromEntries(GROUPS16.map((g) => [g.key, 0]));
  for (const t of targets) for (const g of groupsOfTarget(t).main) out[g] += 1;
  return out;
}

export const RECOVER_DAYS = 2;
export const UNTRAINED_DAYS = 7;
export const HELPER_SHARE = 0.5;

/**
 * Per group: work sets in the `days` days up to `today` (a helper set
 * counts half) and the last day it was a main muscle. Every set ever
 * logged counts, read through `groupsOf(exerciseId)`.
 * @param {{ workouts: any[] }} data
 * @param {(exerciseId: number) => { main: string[], helpers: string[] }} groupsOf
 * @param {string} today
 * @returns {Record<string, { sets: number, last: string | null }>}
 */
export function groupStats(data, groupsOf, today, days = 7) {
  const from = addDays(today, -(days - 1));
  const out = Object.fromEntries(GROUPS16.map((g) => [g.key, { sets: 0, last: null }]));
  const seen = new Map();
  const of = (id) => {
    if (!seen.has(id)) seen.set(id, groupsOf(id));
    return seen.get(id);
  };
  for (const w of data.workouts) {
    if (w.log_date > today) continue;
    const recent = w.log_date >= from;
    for (const s of w.sets || []) {
      const v = hardSetValue(s);
      if (!v) continue;
      const g = of(s.exercise_id);
      for (const k of g.main) {
        if (!out[k]) continue;
        if (recent) out[k].sets += v;
        if (!out[k].last || w.log_date > out[k].last) out[k].last = w.log_date;
      }
      if (recent) for (const k of g.helpers) if (out[k]) out[k].sets += v * HELPER_SHARE;
    }
  }
  return out;
}

/** 'recovering' (main muscle in the last 48 h), 'ready', or 'untrained'
 * (a week or more, or never). */
export function recoveryOf(last, today) {
  if (!last) return 'untrained';
  const ago = daysBetween(last, today);
  return ago < RECOVER_DAYS ? 'recovering' : ago >= UNTRAINED_DAYS ? 'untrained' : 'ready';
}

/** The finer muscles of a group that have their own label, for chips. */
export function musclesOfGroup(key) {
  return (GROUP16[key]?.muscles || []).filter((m) => MUSCLE[m] && MUSCLE[m].catalogue !== false);
}
