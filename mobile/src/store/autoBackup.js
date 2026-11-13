// Automatic backup (BAK-1): the thin part. Every decision is in
// lib/autoBackup.js; this file hands it the phone's folder and saves the
// state it returns. Nothing here runs in the background: a backup is tried
// when the app opens and when it is left, at most once a day.
import { autoState, backupDueNow, fakeFolder, isOurs, OURS, runBackup, withAutoState } from '../lib/autoBackup.js';
import { flagOn } from '../lib/flags.js';
import { APP } from '../lib/version.js';
import { BackupFolder, isNative } from './native.js';
import { content, useData } from './useData.js';

/** Is the feature in this build at all? */
export const autoBackupOn = () => flagOn('auto_backup', APP);

const coded = (err) => Object.assign(new Error(err?.code || err?.message || 'write_failed'), { code: err?.code || err?.message });
const call = (p) => p.catch((err) => { throw coded(err); });

/** The picked folder on the phone, behind the interface runBackup uses. */
const phoneFolder = {
  status: () => BackupFolder.status(),
  pick: () => BackupFolder.pickFolder(),
  forget: () => BackupFolder.forget(),
  list: async () => (await call(BackupFolder.list())).files || [],
  read: async (name) => (await call(BackupFolder.read({ name }))).text,
  write: (name, text) => call(BackupFolder.write({ name, text })),
  rename: (from, to) => call(BackupFolder.rename({ from, to })),
  remove: (name) => call(BackupFolder.remove({ name })),
};

/** The device-test build keeps a pretend folder in localStorage, so the
 * screens and the whole flow run in a browser (like store/fs.js). */
function browserFolder() {
  const K = 'fitness-os-fake-backup-folder';
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch { return {}; } };
  const save = (m) => localStorage.setItem(K, JSON.stringify(m));
  const G = 'fitness-os-fake-backup-granted';
  const f = fakeFolder({}, { store: { load, save } });
  return {
    ...f,
    status: async () => ({ granted: localStorage.getItem(G) === '1', name: 'Fitness OS', synced: false }),
    pick: async () => { localStorage.setItem(G, '1'); return { granted: true, name: 'Fitness OS', synced: false, cancelled: false }; },
    forget: async () => { localStorage.removeItem(G); },
  };
}

const folder = import.meta.env.VITE_FAKE_FS ? browserFolder() : isNative() ? phoneFolder : null;

/** Can this build and this device back up to a folder? */
export const canAutoBackup = () => autoBackupOn() && folder != null;

let running = null;

async function run() {
  const data = useData.getState().data;
  const state = await runBackup(folder, data, content, { now: new Date(), state: autoState(data) });
  useData.getState().update((d) => withAutoState(d, state));
  return state;
}

/** One backup at a time; a second ask waits for the first. */
function once() {
  if (!running) running = run().finally(() => { running = null; });
  return running;
}

/** Called when the app opens and when it is left. Quiet: the result shows
 * in Settings and, if it keeps failing, on Home. */
export async function maybeBackup() {
  if (!canAutoBackup()) return null;
  const { data, ready, loadError, startError } = useData.getState();
  if (!ready || loadError || startError) return null;
  if (!backupDueNow(autoState(data), data, new Date())) return null;
  try {
    return await once();
  } catch {
    return null;
  }
}

/** "Back up now" in Settings: always runs, whatever today's state. */
export async function backupNow() {
  if (!canAutoBackup()) return null;
  return once();
}

/** Turn it on, or pick another folder: Android's picker, then a first
 * checked backup straight away. Returns the state, or null if cancelled. */
export async function pickBackupFolder() {
  if (!canAutoBackup()) return null;
  let picked;
  try {
    picked = await folder.pick();
  } catch {
    picked = { granted: false };
  }
  if (picked?.cancelled) return null;
  useData.getState().update((d) => withAutoState(d, { ...autoState(d), on: true, folder: picked?.name || null, last_error: null, last_hash: null }));
  return once();
}

/** Turn it off. keepFiles false also deletes the app's own backups from
 * the folder (never anything else in it). */
export async function turnOffBackup({ keepFiles = true } = {}) {
  if (!folder) return;
  if (running) await running.catch(() => {});
  if (!keepFiles) {
    try {
      for (const f of await folder.list()) if (isOurs(f.name)) await folder.remove(f.name).catch(() => {});
    } catch {
      // The folder is gone already: nothing to delete.
    }
  }
  await folder.forget().catch(() => {});
  useData.getState().update((d) => withAutoState(d, { on: false }));
}

/** The app's finished backups in the folder, newest first. */
export async function listBackups() {
  if (!folder) return [];
  try {
    return (await folder.list()).filter((f) => OURS.test(f.name)).sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    return [];
  }
}

/** The newest finished backup's text, or null when there is none. Throws
 * when it exists but cannot be read. */
export async function readNewestBackup() {
  const [newest] = await listBackups();
  if (!newest) return null;
  return folder.read(newest.name);
}
