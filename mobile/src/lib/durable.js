// Which saved copy to trust, and how to write one safely (E2-S3, E2-S4).
//
// The data lives in two places on the phone: localStorage and a file in
// the app's private folder. Each save stamps saved_at, and on start the
// newest readable copy wins, whichever store it is in. A copy that can't
// be parsed never wins. Files are written to a .tmp name first and then
// renamed over the old one, so a crash mid-write leaves the old file
// whole. Before every upgrade or import a snapshot is kept; the newest
// SNAPSHOT_KEEP are kept and older ones pruned.
//
// The filesystem is passed in ({ write, rename, remove, read, list }), so
// all of this runs against a fake in tests.
import { migrate, needsMigration } from './migrate.js';

export const SNAPSHOT_DIR = 'snapshots';
export const SNAPSHOT_KEEP = 7;

/** JSON.parse that returns null instead of throwing. */
export function parseCopy(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** The newer of two parsed copies by saved_at. A copy without a stamp
 * (written before stamps existed) counts as oldest; on a tie the file
 * wins, because it is written after localStorage. */
export function pickNewest(local, file) {
  if (!local) return file ? { data: file, from: 'file' } : null;
  if (!file) return { data: local, from: 'local' };
  return (local.saved_at || 0) > (file.saved_at || 0) ? { data: local, from: 'local' } : { data: file, from: 'file' };
}

export function stamp(data, now = Date.now()) {
  return { ...data, saved_at: now };
}

/** Write `text` to `path` without ever leaving a half-written file there. */
export async function atomicWrite(fs, path, text) {
  const tmp = `${path}.tmp`;
  await fs.write(tmp, text);
  await fs.rename(tmp, path);
}

// ── Snapshots ─────────────────────────────────────────────────────────

const REASONS = { migrate: 'Before an app update', import: 'Before an import', restore: 'Before a restore', manual: 'Saved by hand', unreadable: 'Data that could not be read' };

export function snapshotName(reason, now = Date.now()) {
  return `${SNAPSHOT_DIR}/${now}-${reason}.json`;
}

/** Parse a snapshot file name: { at, reason, label } or null. */
export function parseSnapshotName(name) {
  const m = /(?:^|\/)(\d{10,})-([a-z]+)\.json$/.exec(name);
  if (!m) return null;
  return { name: name.includes('/') ? name : `${SNAPSHOT_DIR}/${name}`, at: Number(m[1]), reason: m[2], label: REASONS[m[2]] || 'Snapshot' };
}

/** Snapshots newest first, ignoring anything else in the folder. */
export function sortSnapshots(names) {
  return names.map(parseSnapshotName).filter(Boolean).sort((a, b) => b.at - a.at);
}

/** Which snapshot files to delete so only the newest `keep` remain. */
export function snapshotsToPrune(names, keep = SNAPSHOT_KEEP) {
  return sortSnapshots(names).slice(keep).map((s) => s.name);
}

/** Take a snapshot of `text` and prune old ones. */
export async function takeSnapshot(fs, text, reason, now = Date.now()) {
  const name = snapshotName(reason, now);
  await atomicWrite(fs, name, text);
  for (const old of snapshotsToPrune(await fs.list(SNAPSHOT_DIR))) await fs.remove(old);
  return name;
}

// ── Backup reminder (E2-S11) ──────────────────────────────────────────

export const BACKUP_EVERY_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** { days } since the last backup (null when there has never been one)
 * once a reminder is due, otherwise null. Never-backed-up data is due
 * 14 days after its first log, so a brand-new install isn't nagged. */
export function backupDue(data, now = Date.now()) {
  const dates = [...data.workouts, ...data.body_logs, ...data.meal_logs].map((r) => r.log_date).filter(Boolean);
  if (!dates.length) return null;
  const last = data.settings?.last_backup_at;
  const since = last ? Math.floor((now - last) / DAY) : null;
  if (since != null && since < BACKUP_EVERY_DAYS) return null;
  if (since == null) {
    const first = dates.reduce((a, b) => (a < b ? a : b));
    const [y, m, d] = first.split('-').map(Number);
    if (now - new Date(y, m - 1, d, 12).getTime() < BACKUP_EVERY_DAYS * DAY) return null;
  }
  const snoozed = data.settings?.backup_snoozed_at;
  if (snoozed && now - snoozed < 3 * DAY) return null;
  return { days: since };
}

// ── Start-up ──────────────────────────────────────────────────────────

/** Settle which copy to start from. Takes the raw texts of the two
 * stores; returns { data, from, snapshotText } where snapshotText is the
 * copy to keep before upgrading it (null when no upgrade is needed), or
 * null when neither store holds readable data. Throws NewerSchemaError
 * for data from a newer app version. */
/** True when a saved copy exists but none can be read: the person has
 * data, so this must never look like a new phone (QA-08). */
export function unreadable({ localText, fileText }) {
  const present = [localText, fileText].filter((t) => typeof t === 'string' && t.trim() !== '');
  return present.length > 0 && present.every((t) => !parseCopy(t));
}

export function loadNewest({ localText, fileText }, content) {
  const newest = pickNewest(parseCopy(localText), parseCopy(fileText));
  if (!newest) return null;
  const snapshotText = needsMigration(newest.data) ? (newest.from === 'file' ? fileText : localText) : null;
  return { data: migrate(newest.data, content), from: newest.from, snapshotText };
}
