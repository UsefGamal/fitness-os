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
import { startLine, stampVersion, versionChanged } from '../lib/dataCheck.js';
import { loadNewest, parseCopy, stamp, unreadable } from '../lib/durable.js';
import { backfillEaten } from '../lib/meals.js';
import { migrate, NewerSchemaError } from '../lib/migrate.js';
import { keepPhotoLock } from '../lib/photoLock.js';
import { hasMirror, lastSaveMs, onMirrorResult, readMirror, writeMirror } from './mirror.js';
import { logStart } from './native.js';
import { APP } from '../lib/version.js';
import { SAVE_OK, recordSave } from '../lib/saveHealth.js';
import { snapshot } from './snapshots.js';

// Start-up and save timings for the bug report (PROOF-1). Kept here, never
// in the data.
const T0 = typeof performance !== 'undefined' ? performance.now() : 0;
let startMs = null;
export const perf = () => ({ startMs, saveMs: lastSaveMs() });
const started = () => { if (startMs == null && typeof performance !== 'undefined') startMs = Math.round(performance.now() - T0); };

const KEY = 'fitness-os-data-v1'; // the key name predates schema versions; it stays
const SAVE_DELAY = 400;

let pending = null; // data waiting to be written
let timer = null;
let blocked = false; // data from a newer app version: never overwrite it

/** Write anything waiting now. `hidden`: the app is going to the
 * background, so the file is written at once too, not 300 ms later. */
export function flushSave(hidden = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending || blocked) return;
  const data = stamp(pending);
  pending = null;
  report('local', saveLocal(data));
  writeMirror(data, hidden);
}

// Whether the last writes landed (lib/saveHealth.js); the store's
// saveFailing drives the "Couldn't save" bar.
let health = SAVE_OK;
function report(channel, ok) {
  health = recordSave(health, channel, ok, { hasFile: hasMirror });
  if (useData.getState().saveFailing !== health.failing) useData.setState({ saveFailing: health.failing });
}
onMirrorResult((ok) => report('file', ok));

function scheduleSave(data) {
  if (blocked) return;
  pending = data;
  if (!timer) timer = setTimeout(flushSave, SAVE_DELAY);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(true); });
  window.addEventListener('pagehide', () => flushSave(true));
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
    return true;
  } catch {
    // Storage full or blocked: the file mirror still has it, and its newer
    // saved_at makes it win on the next start. If that fails too, the bar shows.
    return false;
  }
}

/** Any saved copy, brought up to date: the schema (lib/migrate.js) and the
 * numbers on ticked meals (DA-1). */
const upgrade = (raw) => backfillEaten(migrate(raw, content), content.nutrition);

/** First paint uses localStorage straight away; hydrate() then checks the
 * file too and settles which copy wins. */
function initialData() {
  const local = parseCopy(readLocalText());
  if (!local) return D.emptyData(content);
  try {
    return upgrade(local);
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
    const data = upgrade(parseCopy(text));
    // Keep what couldn't be read, so this restore can be undone too.
    const raw = get().rawCopies.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (raw) await snapshot(raw, 'unreadable');
    blocked = false;
    set({ data, startError: null });
    pending = data;
    flushSave();
  },

  /** True while no copy could be written (storage full): the data is only in memory. */
  saveFailing: false,

  /** Try the write again (the bar's button). */
  retrySave() {
    pending = get().data;
    flushSave(true);
  },

  /** Run once at start: pick the newest copy, upgrade it if needed. */
  async hydrate() {
    let file;
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
      logStart(startLine({ version: APP.version, error: 'unreadable' }));
      return;
    }
    try {
      const start = loadNewest({ localText, fileText: file?.text ?? null }, content);
      if (start) {
        if (start.snapshotText) await snapshot(start.snapshotText, 'migrate');
        // A new app version with no data upgrade still keeps one copy first.
        else if (versionChanged(start.data, APP.version)) await snapshot(start.from === 'file' ? file.text : localText, 'update');
        // Ticked meals from older builds get their numbers copied in (DA-1).
        start.data = stampVersion(backfillEaten(start.data, content.nutrition), APP.version);
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
      logStart(startLine({ version: APP.version, error: err instanceof NewerSchemaError ? 'newer' : 'failed' }));
      return;
    }
    const data = get().data;
    const active = data.workouts.find((w) => w.started_at && !w.finished_at);
    set({ ready: true, activeWorkoutId: active ? active.id : null });
    started();
    logStart(startLine({ version: APP.version, data }));
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
    data = backfillEaten(keepPhotoLock(get().data, data), content.nutrition);
    set({ data, activeWorkoutId: null });
    pending = data;
    flushSave();
  },

  setActiveWorkout(id) {
    set({ activeWorkoutId: id });
  },
}));

export { content };
