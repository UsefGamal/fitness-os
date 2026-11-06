// The one store. Data lives in localStorage and, on the phone, also in a
// file in the app's private storage (store/mirror.js). Each save stamps
// saved_at, and on start the newest readable copy wins (lib/durable.js),
// so a failed localStorage write can't bring back stale data. Every copy
// goes through lib/migrate.js; before an upgrade a snapshot of the old
// data is kept (store/snapshots.js). Writes are batched: the screen
// updates at once, the disk a moment later (at most SAVE_DELAY ms) or
// straight away when the app goes to the background. There is no server:
// this is the only copy, so "Export a backup" in Settings matters.
import { create } from 'zustand';

import content from '../content.json';
import * as D from '../lib/data.js';
import { loadNewest, parseCopy, stamp, unreadable } from '../lib/durable.js';
import { migrate, NewerSchemaError } from '../lib/migrate.js';
import { readMirror, writeMirror } from './mirror.js';
import { snapshot } from './snapshots.js';

const KEY = 'fitness-os-data-v1'; // the key name predates schema versions; it stays
const SAVE_DELAY = 400;

let pending = null; // data waiting to be written
let timer = null;
let blocked = false; // data from a newer app version: never overwrite it

/** Write anything waiting now (also called when the app is hidden). */
export function flushSave() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending || blocked) return;
  const data = stamp(pending);
  pending = null;
  saveLocal(data);
  writeMirror(data);
}

function scheduleSave(data) {
  if (blocked) return;
  pending = data;
  if (!timer) timer = setTimeout(flushSave, SAVE_DELAY);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);
}

function readLocalText() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function saveLocal(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the file mirror still has it, and its newer
    // saved_at makes it win on the next start.
  }
}

/** First paint uses localStorage straight away; hydrate() then checks the
 * file too and settles which copy wins. */
function initialData() {
  const local = parseCopy(readLocalText());
  if (!local) return D.emptyData(content);
  try {
    return migrate(local, content);
  } catch {
    return D.emptyData(content);
  }
}

export const useData = create((set, get) => ({
  data: initialData(),
  ready: false,
  activeWorkoutId: null,
  /** Set when the saved data is from a newer app version (see App.jsx). */
  loadError: null,
  /** Set when start-up couldn't load the data: 'unreadable' (a copy exists
   * but none parses) or 'failed' (anything else). App.jsx then shows the
   * recovery screen, never Setup or a black screen (TL-03, QA-08). Nothing
   * is written while it is set. */
  startError: null,
  /** The raw saved texts, for "Save a copy of my data" on that screen. */
  rawCopies: [],

  /** Use a snapshot's data after a failed start (recovery screen). */
  async recoverFrom(text) {
    const data = migrate(parseCopy(text), content);
    // Keep what couldn't be read, so this restore can be undone too.
    const raw = get().rawCopies.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (raw) await snapshot(raw, 'unreadable');
    blocked = false;
    set({ data, startError: null });
    pending = data;
    flushSave();
  },

  /** Run once at start: pick the newest copy, upgrade it if needed. */
  async hydrate() {
    let file = null;
    const localText = readLocalText();
    try {
      file = await readMirror();
    } catch {
      file = null;
    }
    const rawCopies = [localText, file?.text].filter((t) => typeof t === 'string' && t.trim() !== '');
    if (unreadable({ localText, fileText: file?.text ?? null })) {
      blocked = true;
      set({ startError: 'unreadable', rawCopies, ready: true });
      return;
    }
    try {
      const start = loadNewest({ localText, fileText: file?.text ?? null }, content);
      if (start) {
        if (start.snapshotText) await snapshot(start.snapshotText, 'migrate');
        set({ data: start.data });
        // Write the winner back to both stores, so the one that was behind
        // (cleared, full, or not yet upgraded) catches up.
        pending = start.data;
        flushSave();
      }
    } catch (err) {
      blocked = true;
      if (err instanceof NewerSchemaError) set({ loadError: err.message, ready: true });
      else set({ startError: 'failed', rawCopies, ready: true });
      return;
    }
    const data = get().data;
    const active = data.workouts.find((w) => w.started_at && !w.finished_at);
    set({ ready: true, activeWorkoutId: active ? active.id : null });
  },

  /** Apply a pure change from lib/data.js and persist it. */
  update(fn) {
    if (blocked) return;
    const data = fn(get().data);
    set({ data });
    scheduleSave(data);
  },

  /** Replace everything (import, restore, reset), after a snapshot of what
   * is there now. Written at once. */
  async replaceAll(data, reason = 'import') {
    if (blocked) return;
    await snapshot(JSON.stringify(stamp(get().data)), reason);
    set({ data, activeWorkoutId: null });
    pending = data;
    flushSave();
  },

  setActiveWorkout(id) {
    set({ activeWorkoutId: id });
  },
}));

export { content };
