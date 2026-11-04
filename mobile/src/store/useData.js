// The one store. Data lives in localStorage and, on the phone, is also
// mirrored to a file in the app's private storage, so a cleared WebView
// cache can't lose it (store/mirror.js). Writes are batched: the screen
// updates at once, the disk a moment later (at most SAVE_DELAY ms) or
// straight away when the app goes to the background. There is no
// server: this is the only copy, so "Export a backup" in Settings matters.
import { create } from 'zustand';

import content from '../content.json';
import * as D from '../lib/data.js';
import { readMirror, writeMirror } from './mirror.js';

const KEY = 'fitness-os-data-v1';
const SAVE_DELAY = 400;

let pending = null; // data waiting to be written
let timer = null;

/** Write anything waiting now (also called when the app is hidden). */
export function flushSave() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending) return;
  const data = pending;
  pending = null;
  saveLocal(data);
  writeMirror(data);
}

function scheduleSave(data) {
  pending = data;
  if (!timer) timer = setTimeout(flushSave, SAVE_DELAY);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocal(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the file mirror still has it.
  }
}

export const useData = create((set, get) => ({
  data: loadLocal() || D.emptyData(content),
  ready: false,
  activeWorkoutId: null,

  /** Run once at start: if localStorage was wiped, restore from the file. */
  async hydrate() {
    if (!loadLocal()) {
      const fromFile = await readMirror();
      if (fromFile) set({ data: fromFile });
    }
    const data = get().data;
    const active = data.workouts.find((w) => w.started_at && !w.finished_at);
    set({ ready: true, activeWorkoutId: active ? active.id : null });
  },

  /** Apply a pure change from lib/data.js and persist it. */
  update(fn) {
    const data = fn(get().data);
    set({ data });
    scheduleSave(data);
  },

  replaceAll(data) {
    set({ data, activeWorkoutId: null });
    pending = data;
    flushSave(); // an import or reset is written at once
  },

  setActiveWorkout(id) {
    set({ activeWorkoutId: id });
  },
}));

export { content };
