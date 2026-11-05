// Snapshots of the data, kept in the app's private folder (E2-S3): one is
// taken before every app-update migration, import and restore, and the
// newest seven are kept. In a browser (dev) they live in localStorage.
import { parseCopy, SNAPSHOT_DIR, sortSnapshots, takeSnapshot } from '../lib/durable.js';
import { privateFs } from './fs.js';

const PREFIX = 'fitness-os-fs:';
const browserFs = {
  read: async (path) => { try { return localStorage.getItem(PREFIX + path); } catch { return null; } },
  write: async (path, text) => { localStorage.setItem(PREFIX + path, text); },
  rename: async (from, to) => {
    const v = localStorage.getItem(PREFIX + from);
    localStorage.setItem(PREFIX + to, v);
    localStorage.removeItem(PREFIX + from);
  },
  remove: async (path) => { try { localStorage.removeItem(PREFIX + path); } catch { /* gone already */ } },
  list: async (dir) => {
    try {
      return Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIX}${dir}/`)).map((k) => k.slice(PREFIX.length));
    } catch {
      return [];
    }
  },
};

const fs = () => privateFs || (typeof localStorage !== 'undefined' ? browserFs : null);

/** Keep a copy of `text` (raw JSON) before something replaces it. Never
 * throws: a failed snapshot is logged, and the caller decides. */
export async function snapshot(text, reason) {
  const f = fs();
  if (!f || !text) return null;
  try {
    return await takeSnapshot(f, text, reason);
  } catch (err) {
    console.error('Could not save a snapshot', err);
    return null;
  }
}

export async function listSnapshots() {
  const f = fs();
  return f ? sortSnapshots(await f.list(SNAPSHOT_DIR)) : [];
}

/** The raw text of a snapshot, or null if it can't be read. */
export async function readSnapshot(name) {
  const f = fs();
  const text = f ? await f.read(name) : null;
  return parseCopy(text) ? text : null;
}
