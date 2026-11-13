// Automatic backup (BAK-1): the thin part. Every decision is in
// lib/autoBackup.js; this file hands it the phone's folder and saves the
// state it returns. Nothing here runs in the background: a backup is tried
// when the app opens and when it is left, at most once a day.
import { autoState, backupDueNow, fakeFolder, isOurs, OURS, provesBackup, runBackup, withAutoState } from '../lib/autoBackup.js';
import { decryptWithKey, decryptWithPassphrase, fromB64, isEncrypted, kidOf, makeRecovery, newDataKey, toB64 } from '../lib/backupCrypto.js';
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

/** Turn { key, meta } from storage into { key, kid, recovery }, or null. */
function keysFrom(out) {
  if (!out?.key || !out?.meta) return null;
  try {
    const meta = JSON.parse(out.meta);
    const key = fromB64(out.key);
    return key.length === 32 && typeof meta.kid === 'string' && meta.recovery ? { key, kid: meta.kid, recovery: meta.recovery } : null;
  } catch {
    return null;
  }
}
const toStored = (k) => ({ key: toB64(k.key), meta: JSON.stringify({ kid: k.kid, recovery: k.recovery }) });

/** The data key for encrypted backups, kept wrapped by the Keystore. */
const phoneKeys = {
  load: async () => keysFrom(await BackupFolder.loadKey()),
  store: (k) => BackupFolder.storeKey(toStored(k)),
  forget: () => BackupFolder.forgetKey(),
};

/** The device-test build keeps a pretend folder in localStorage, so the
 * screens and the whole flow run in a browser (like store/fs.js). Setting
 * fitness-os-fake-backup-synced to '1' makes it a "cloud" folder. Its key
 * sits in localStorage: that build is for tests only, never for a person. */
function browserKeys() {
  const K = 'fitness-os-fake-backup-key';
  return {
    load: async () => { try { return keysFrom(JSON.parse(localStorage.getItem(K) || 'null')); } catch { return null; } },
    store: async (k) => localStorage.setItem(K, JSON.stringify(toStored(k))),
    forget: async () => localStorage.removeItem(K),
  };
}

function browserFolder() {
  const K = 'fitness-os-fake-backup-folder';
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch { return {}; } };
  const save = (m) => localStorage.setItem(K, JSON.stringify(m));
  const G = 'fitness-os-fake-backup-granted';
  const S = 'fitness-os-fake-backup-synced';
  const f = fakeFolder({}, { store: { load, save } });
  return {
    ...f,
    status: async () => ({ granted: localStorage.getItem(G) === '1', name: 'Fitness OS', synced: localStorage.getItem(S) === '1' }),
    pick: async () => { localStorage.setItem(G, '1'); return { granted: true, name: 'Fitness OS', synced: localStorage.getItem(S) === '1', cancelled: false }; },
    forget: async () => { localStorage.removeItem(G); },
  };
}

const folder = import.meta.env.VITE_FAKE_FS ? browserFolder() : isNative() ? phoneFolder : null;
const keyStore = import.meta.env.VITE_FAKE_FS ? browserKeys() : isNative() ? phoneKeys : null;

/** The data key on this phone, or null (none yet, or the Keystore lost it). */
async function loadKeys() {
  if (!keyStore) return null;
  try {
    return await keyStore.load();
  } catch {
    return null;
  }
}

/** Can this build and this device back up to a folder? */
export const canAutoBackup = () => autoBackupOn() && folder != null;

let running = null;

async function run() {
  const data = useData.getState().data;
  const keys = await loadKeys();
  const state = await runBackup(folder, data, content, { now: new Date(), state: autoState(data), keys });
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
  // A cloud folder with no key yet: nothing is written until the person
  // sets a recovery passphrase (runBackup records needs_passphrase).
  return once();
}

/** Set the recovery passphrase for a cloud folder: make the data key, keep
 * it in the Keystore, write the first encrypted backup, then open that
 * file again with the passphrase alone and compare it with the app. Only a
 * match leaves backup on. Returns { ok, ms, state }; ms is how long the
 * passphrase took to stretch (the PR's "needs a real phone" number). */
export async function setRecoveryPassphrase(passphrase) {
  if (!canAutoBackup() || !keyStore) return { ok: false, ms: 0, state: null };
  if (running) await running.catch(() => {});
  const fresh = newDataKey();
  const t0 = performance.now();
  const recovery = await makeRecovery(fresh.key, passphrase);
  const ms = Math.round(performance.now() - t0);
  const failed = async (state) => {
    await keyStore.forget().catch(() => {});
    const bad = { ...(state || autoState(useData.getState().data)), on: true, last_error: 'check_failed' };
    useData.getState().update((d) => withAutoState(d, bad));
    return { ok: false, ms, state: bad };
  };
  try {
    await keyStore.store({ ...fresh, recovery });
  } catch {
    return failed(null);
  }
  const state = await once();
  if (!state || state.last_error || !state.last_name) return failed(state);
  try {
    const text = await folder.read(state.last_name);
    const plain = await decryptWithPassphrase(text, passphrase);
    if (!provesBackup(plain, useData.getState().data, content)) return failed(state);
  } catch {
    return failed(state);
  }
  return { ok: true, ms, state };
}

/** A backup's plain text. Plain files come back as they are. An encrypted
 * one opens with this phone's key when it made the file, else needs the
 * recovery passphrase: returns null to ask for it. Throws a
 * BackupCryptoError (wrong_passphrase, damaged) otherwise. */
export async function unlockBackup(text, passphrase = null) {
  if (!isEncrypted(text)) return text;
  if (passphrase != null) return decryptWithPassphrase(text, passphrase);
  const keys = await loadKeys();
  if (keys && keys.kid === kidOf(text)) return decryptWithKey(text, keys.key);
  return null;
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
  if (keyStore) await keyStore.forget().catch(() => {});
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
