// Exercise replacements: other exercises in the bundled catalogue
// (free-exercise-db) that train the same muscles, grouped by the equipment
// they need. Pure helpers; no React, no catalogue loading.

import { MUSCLE_GROUP } from './catalogue.js';

const PRIMARY = 3;
const SECONDARY = 1;

// Equipment folded into the clusters shown on screen, in display order.
export const EQUIPMENT_CLUSTERS = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell & bands', 'Other'];

export function clusterOf(equipment) {
  switch (equipment) {
    case 'barbell':
    case 'e-z curl bar':
      return 'Barbell';
    case 'dumbbell':
      return 'Dumbbell';
    case 'cable':
      return 'Cable';
    case 'machine':
      return 'Machine';
    case 'body only':
    case null:
    case undefined:
      return 'Bodyweight';
    case 'kettlebells':
    case 'bands':
      return 'Kettlebell & bands';
    default:
      return 'Other';
  }
}

// Strength and powerlifting work can stand in for each other; stretches,
// plyometrics, Olympic lifts, strongman and cardio only for their own kind.
const STRENGTH = new Set(['strength', 'powerlifting']);
const kind = (e) => (STRENGTH.has(e.category) ? 'strength' : e.category || 'strength');

function weights(e) {
  const w = new Map();
  for (const m of e.secondary || []) w.set(m, SECONDARY);
  for (const m of e.primary || []) w.set(m, PRIMARY);
  return w;
}

/** How alike two exercises are, 0 to 1. Weighted overlap of the muscles
 * (main muscles count three times a helper muscle), plus a little for the
 * same push/pull direction and the same compound/isolation kind. Zero when
 * they share no main muscle or are different kinds of work. */
export function similarity(a, b) {
  if (kind(a) !== kind(b)) return 0;
  if (!(a.primary || []).some((m) => (b.primary || []).includes(m))) return 0;
  const wa = weights(a);
  const wb = weights(b);
  let both = 0;
  let either = 0;
  for (const m of new Set([...wa.keys(), ...wb.keys()])) {
    both += Math.min(wa.get(m) || 0, wb.get(m) || 0);
    either += Math.max(wa.get(m) || 0, wb.get(m) || 0);
  }
  let score = either ? both / either : 0;
  if (a.force && a.force === b.force) score += 0.1;
  if (a.mechanic && a.mechanic === b.mechanic) score += 0.1;
  score += 0.05 * Math.min(3, sharedWords(a.name, b.name));
  return Math.min(1, score / 1.35);
}

// Words that say nothing about the movement itself.
const FILLER = new Set(['a', 'the', 'with', 'on', 'to', 'of', 'and', 'one', 'arm', 'leg', 'grip', 'medium', 'wide', 'close', 'narrow', 'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'band', 'bands', 'kettlebell', 'lever', 'leverage', 'seated', 'standing', 'lying', 'alternating', 'single', 'version']);
const words = (name) => new Set(name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !FILLER.has(w)));

/** How many movement words two names share ("lateral", "raise", "deadlift"...). */
export function sharedWords(a, b) {
  const wb = words(b);
  return [...words(a)].filter((w) => wb.has(w)).length;
}

/** Catalogue entries most like `entry`, best first: [{ entry, score, cluster }]. */
export function alternatives(entry, entries, { limit = Infinity, minScore = 0.35 } = {}) {
  return entries
    .filter((e) => e.id !== entry.id)
    .map((e) => ({ entry: e, score: similarity(entry, e), cluster: clusterOf(e.equipment) }))
    .filter((r) => r.score >= minScore)
    .sort((x, y) => y.score - x.score || x.entry.name.localeCompare(y.entry.name))
    .slice(0, limit);
}

/** Group a ranked list into equipment clusters, keeping at most `perCluster`
 * in each: [{ cluster, items }], in EQUIPMENT_CLUSTERS order, empty ones left out. */
export function byCluster(ranked, perCluster = 3) {
  const out = new Map(EQUIPMENT_CLUSTERS.map((c) => [c, []]));
  for (const r of ranked) {
    const list = out.get(r.cluster);
    if (list.length < perCluster) list.push(r);
  }
  return [...out].filter(([, items]) => items.length).map(([cluster, items]) => ({ cluster, items }));
}

/** For an exercise with no catalogue match: strength exercises whose main
 * muscle is in the app's muscle group (Chest, Back, Legs...), simplest first. */
export function forGroup(group, entries, { limit = 30 } = {}) {
  const rank = { beginner: 0, intermediate: 1, expert: 2 };
  return entries
    .filter((e) => kind(e) === 'strength' && MUSCLE_GROUP[(e.primary || [])[0]] === group)
    .sort((x, y) => (rank[x.level] ?? 1) - (rank[y.level] ?? 1) || x.name.localeCompare(y.name))
    .slice(0, limit)
    .map((e) => ({ entry: e, score: 0, cluster: clusterOf(e.equipment) }));
}

/** One line on why `b` can replace `a`: the muscles they share. */
export function sharedMuscles(a, b) {
  const main = (a.primary || []).filter((m) => (b.primary || []).includes(m));
  const helpers = (a.secondary || []).filter((m) => [...(b.primary || []), ...(b.secondary || [])].includes(m));
  return [...main, ...helpers.filter((m) => !main.includes(m))];
}
