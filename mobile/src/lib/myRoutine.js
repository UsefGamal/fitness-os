// Make my own routine (E4-S17). A session someone builds is saved on the
// running plan block next to the plan's own sessions, so Today, Plan, the
// workout screen and history treat it like any other session. Pure
// helpers; myRoutine.test.js holds the cases.

import { addCustomExercise, exerciseByName } from './data.js';
import { activeBlock } from './plan.js';

export const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const REST_CHOICES = [45, 60, 90, 120, 180];
export const MAX_NAME = 40;

/** The sessions on the running block that the person made. */
export function mySessions(data) {
  const block = activeBlock(data);
  const overrides = block?.overrides || {};
  return (block?.sessions || []).filter((s) => s.custom).map((s) => (overrides[s.key] ? { ...s, exercises: overrides[s.key] } : s));
}

export function mySession(data, key) {
  return mySessions(data).find((s) => s.key === key) || null;
}

function restText(sec) {
  return sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`;
}

/** One exercise row in the plan's shape. */
export function row(name, { sets = 3, reps = '8-12', restSec = 90 } = {}) {
  return { name, sets, reps, rest: restText(restSec), rest_sec: restSec, rir: '2-3', type: 'normal' };
}

function withBlock(data, fn) {
  const block = activeBlock(data);
  if (!block) return data;
  const next = fn(block);
  if (next === block) return data;
  return { ...data, program: { ...data.program, blocks: data.program.blocks.map((b) => (b === block ? next : b)) } };
}

function cleanName(name) {
  return String(name || '').trim().slice(0, MAX_NAME);
}

/** Add an empty session called `name`. Returns { data, key }. */
export function createSession(data, name) {
  const label = cleanName(name);
  const block = activeBlock(data);
  if (!label || !block) return { data, key: null };
  const used = new Set((block.sessions || []).map((s) => s.key));
  let n = 1;
  while (used.has(`my_${n}`)) n += 1;
  const key = `my_${n}`;
  const session = {
    key,
    day_letter: label[0].toUpperCase(),
    label,
    focus: '',
    warmup: [],
    warmup_items: [],
    pre_cardio: '',
    cooldown: [],
    cardio_after: null,
    exercises: [],
    custom: true,
  };
  return { data: withBlock(data, (b) => ({ ...b, sessions: [...(b.sessions || []), session] })), key };
}

function editSession(data, key, fn) {
  return withBlock(data, (b) => {
    const sessions = b.sessions || [];
    if (!sessions.some((s) => s.key === key && s.custom)) return b;
    // The editor is the one place this session changes, so an edit made
    // from the Plan page's Edit list folds into it.
    const { [key]: folded, ...overrides } = b.overrides || {};
    const base = folded ? sessions.map((s) => (s.key === key ? { ...s, exercises: folded } : s)) : sessions;
    return { ...b, overrides, sessions: base.map((s) => (s.key === key ? fn(s) : s)) };
  });
}

export function renameSession(data, key, name) {
  const label = cleanName(name);
  if (!label) return data;
  return editSession(data, key, (s) => ({ ...s, label, day_letter: label[0].toUpperCase() }));
}

/** Add an exercise (and put it in the Library when it isn't there, so it
 * can be logged). `group` is the app group for a new Library entry. */
export function addExercise(data, key, { name, group = 'Other', equipment = null }) {
  const clean = String(name || '').trim();
  if (!clean || !mySession(data, key)) return data;
  const withLib = exerciseByName(data, clean) ? data : addCustomExercise(data, { name: clean, muscle_group: group, equipment });
  return editSession(withLib, key, (s) => ({ ...s, exercises: [...s.exercises, row(clean)] }));
}

/** Change sets, reps or rest of exercise `i`. */
export function setExercise(data, key, i, { sets, reps, restSec }) {
  return editSession(data, key, (s) => ({
    ...s,
    exercises: s.exercises.map((x, j) => {
      if (j !== i) return x;
      const out = { ...x };
      if (sets != null) out.sets = Math.max(1, Math.min(10, Math.round(sets)));
      if (reps != null && String(reps).trim()) out.reps = String(reps).trim().slice(0, 20);
      if (restSec != null) { out.rest_sec = restSec; out.rest = restText(restSec); }
      return out;
    }),
  }));
}

export function removeExercise(data, key, i) {
  return editSession(data, key, (s) => ({ ...s, exercises: s.exercises.filter((_, j) => j !== i) }));
}

export function moveExercise(data, key, i, dir) {
  return editSession(data, key, (s) => {
    const j = i + dir;
    if (j < 0 || j >= s.exercises.length) return s;
    const ex = [...s.exercises];
    [ex[i], ex[j]] = [ex[j], ex[i]];
    return { ...s, exercises: ex };
  });
}

/** The weekdays the session is on. */
export function daysOf(data, key) {
  const schedule = activeBlock(data)?.schedule || [];
  return schedule.filter((e) => e.session === key).map((e) => e.day);
}

/** Put the session on exactly these weekdays. A day it leaves becomes a
 * rest day; a day it takes over drops what was there. */
export function setDays(data, key, days) {
  if (!mySession(data, key)) return data;
  const want = new Set(days.filter((d) => WEEK.includes(d)));
  return withBlock(data, (b) => {
    const current = b.schedule || [];
    const schedule = WEEK.map((day, i) => {
      const entry = current.find((e) => e.day === day) || { day, plan_day: i + 1, session: 'rest', cardio_after: null };
      if (want.has(day)) return { ...entry, session: key, cardio_after: null };
      if (entry.session === key) return { ...entry, session: 'rest', cardio_after: null };
      return { ...entry };
    });
    return { ...b, schedule };
  });
}

/** Delete a session the person made; its days become rest days. Workouts
 * already logged keep their label. */
export function deleteSession(data, key) {
  const cleared = setDays(data, key, []);
  return withBlock(cleared, (b) => ({
    ...b,
    sessions: (b.sessions || []).filter((s) => !(s.custom && s.key === key)),
    overrides: Object.fromEntries(Object.entries(b.overrides || {}).filter(([k]) => k !== key)),
  }));
}

/** Hard sets per app group in a session, biggest first: [['Chest', 9], ...]. */
export function setsByGroup(data, exercises) {
  const byName = new Map(data.exercises.map((e) => [e.name, e.muscle_group]));
  const out = new Map();
  for (const x of exercises) {
    const g = byName.get(x.name) || 'Other';
    out.set(g, (out.get(g) || 0) + (Number(x.sets) || 0));
  }
  return [...out].sort((a, b) => b[1] - a[1]);
}
