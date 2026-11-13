// Automatic backup (BAK-1). The person picks a folder once; from then on
// the app writes one checked backup a day into it. Everything that decides
// something is here and runs against a small "folder" interface:
//
//   status()            -> { granted, name, synced }
//   list()              -> [{ name, size, modified }]
//   read(name)          -> text
//   write(name, text)   -> writes (replaces) one file
//   rename(from, to)    -> replaces `to`
//   remove(name)        -> deletes one file
//
// store/autoBackup.js gives it the phone's folder; the tests give it
// fakeFolder(). No file that is not the app's own is ever read, replaced
// or deleted, and the folder grant itself never enters the data file.
import { dataHash } from './dataCheck.js';
import { parseDataFile, summarize, toDataFile } from './dataFile.js';
import { todayISO, weekStart } from './dates.js';

/** The app's own finished backups in the folder. */
export const OURS = /^fitness-os-backup-(\d{4}-\d{2}-\d{2})\.json(\.enc)?$/;
/** A backup still being written and checked. */
export const OURS_TMP = /^fitness-os-backup-\d{4}-\d{2}-\d{2}\.json(\.enc)?\.tmp$/;

export const KEEP_DAILY = 7;
export const KEEP_WEEKLY = 4;
/** Home's reminder comes back when the last checked backup is older. */
export const STALE_DAYS = 3;

/** What can go wrong, in the order Settings explains them. */
export const ERRORS = ['folder_gone', 'synced_not_yet', 'no_space', 'write_failed', 'check_failed'];

export function backupName(iso) {
  return `fitness-os-backup-${iso}.json`;
}

export function isOurs(name) {
  return typeof name === 'string' && (OURS.test(name) || OURS_TMP.test(name));
}

/** The saved state (settings.auto_backup), with safe defaults. */
export function autoState(data) {
  const a = data?.settings?.auto_backup;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return { on: false };
  return {
    on: a.on === true,
    folder: typeof a.folder === 'string' ? a.folder.slice(0, 120) : null,
    last_checked_at: Number.isFinite(a.last_checked_at) ? a.last_checked_at : null,
    last_name: isOurs(a.last_name) ? a.last_name : null,
    last_hash: typeof a.last_hash === 'string' ? a.last_hash.slice(0, 20) : null,
    last_error: ERRORS.includes(a.last_error) ? a.last_error : null,
  };
}

export function withAutoState(data, state) {
  return { ...data, settings: { ...data.settings, auto_backup: state } };
}

/** Is a backup due now? On, nothing checked today, and what the person
 * logged differs from the last checked backup. The comparison is the data
 * check code and not saved_at, because recording the backup is itself a
 * save and would make every day look changed. */
export function backupDueNow(state, data, now = new Date()) {
  if (!state?.on) return false;
  if (state.last_checked_at && todayISO(new Date(state.last_checked_at)) === todayISO(now) && !state.last_error) return false;
  return state.last_error != null || state.last_hash !== dataHash(data);
}

/** Healthy: on, no error, and checked within the last STALE_DAYS days. */
export function backupHealthy(state, now = Date.now()) {
  return Boolean(state?.on && !state.last_error && state.last_checked_at && now - state.last_checked_at < STALE_DAYS * 86400000);
}

/** The backup's text: the manual export's content on one line. Photos
 * are files and are never part of it. */
export function backupText(data, now = new Date()) {
  return toDataFile(data, now, { compact: true });
}

/** Does this text restore to the same data? Counts and the data check
 * code must both match what is in the app now. */
export function provesBackup(text, data, content) {
  let back;
  try {
    back = parseDataFile(text, content);
  } catch {
    return false;
  }
  const a = summarize(back);
  const b = summarize(data);
  return a.workouts === b.workouts && a.sets === b.sets && a.meals === b.meals && a.weighIns === b.weighIns && dataHash(back) === dataHash(data);
}

/** Which of the folder's files to delete after today's checked backup.
 * Keeps the newest KEEP_DAILY daily files and, older than those, the
 * newest file of each of the KEEP_WEEKLY most recent weeks. Only ever
 * returns the app's own names; anything else in the folder is ignored. */
export function toPrune(names, today) {
  const out = names.filter((n) => typeof n === 'string' && OURS_TMP.test(n));
  const dated = names
    .filter((n) => typeof n === 'string' && OURS.test(n))
    .map((n) => ({ name: n, date: OURS.exec(n)[1] }))
    // A file dated after today (a changed clock) is left alone.
    .filter((f) => f.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name < b.name ? -1 : 1));
  const keepDays = new Set();
  for (const f of dated) if (keepDays.size < KEEP_DAILY) keepDays.add(f.date);
  const weeks = new Set();
  for (const f of dated) {
    if (keepDays.has(f.date)) continue;
    const week = weekStart(f.date);
    if (!weeks.has(week) && weeks.size < KEEP_WEEKLY) weeks.add(week);
    else out.push(f.name);
  }
  return out;
}

function codeOf(err, fallback) {
  const code = err?.code || err?.message;
  return ERRORS.includes(code) ? code : fallback;
}

/** Write today's backup and prove it. Returns the new state; never throws.
 * Order: write a .tmp, read it back, check it restores to the same data,
 * only then give it its real name, then prune. A failure at any step
 * leaves every earlier good backup in place. */
export async function runBackup(folder, data, content, { now = new Date(), state = autoState(data) } = {}) {
  const fail = (last_error, extra = {}) => ({ ...state, on: true, ...extra, last_error });
  let status;
  try {
    status = await folder.status();
  } catch {
    return fail('folder_gone');
  }
  if (!status?.granted) return fail('folder_gone');
  const named = { folder: status.name || state.folder || null };
  // A folder that syncs to a cloud gets no plain file: health data would
  // leave the phone unencrypted. Encrypted backup comes later.
  if (status.synced) return fail('synced_not_yet', named);

  const today = todayISO(now);
  const name = backupName(today);
  const tmp = `${name}.tmp`;
  const text = backupText(data, now);
  try {
    await folder.write(tmp, text);
  } catch (err) {
    await folder.remove(tmp).catch(() => {});
    return fail(codeOf(err, 'write_failed'), named);
  }
  const back = await folder.read(tmp).catch(() => null);
  if (typeof back !== 'string' || !provesBackup(back, data, content)) {
    await folder.remove(tmp).catch(() => {});
    return fail('check_failed', named);
  }
  try {
    await folder.rename(tmp, name);
  } catch (err) {
    await folder.remove(tmp).catch(() => {});
    return fail(codeOf(err, 'write_failed'), named);
  }
  // Today's file is proven; old ones may go. A prune that fails is not a
  // failed backup, it only leaves more files than needed.
  try {
    const names = (await folder.list()).map((f) => f.name);
    for (const old of toPrune(names, today)) if (isOurs(old) && old !== name) await folder.remove(old).catch(() => {});
  } catch {
    // Nothing to do: the backup itself is safe.
  }
  return { on: true, ...named, last_checked_at: now.getTime(), last_name: name, last_hash: dataHash(data), last_error: null };
}

/** The newest finished backup in the folder, or null. */
export function newestBackup(names) {
  const ours = names.filter((n) => typeof n === 'string' && OURS.test(n)).sort((a, b) => (OURS.exec(a)[1] < OURS.exec(b)[1] ? 1 : -1));
  return ours[0] || null;
}

/** First and last log dates in a data file, for the restore preview. */
export function dateRange(data) {
  const dates = [...(data.workouts || []), ...(data.body_logs || []), ...(data.meal_logs || [])].map((r) => r.log_date).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.length ? { first: dates[0], last: dates.at(-1) } : null;
}

/** A folder in memory, with the same methods as the phone's. For tests
 * and for the browser builds, where no real folder exists. `fault` can
 * break one step on purpose: 'revoked', 'synced', 'full', 'corrupt',
 * 'rename'. */
export function fakeFolder(files = {}, { fault = null, name = 'Fitness OS', store = null } = {}) {
  const load = () => (store ? store.load() : files);
  const save = (m) => { if (store) store.save(m); };
  const self = {
    files,
    fault,
    async status() { return { granted: self.fault !== 'revoked', name, synced: self.fault === 'synced' }; },
    async list() { return Object.entries(load()).map(([n, text]) => ({ name: n, size: String(text).length, modified: 0 })); },
    async read(n) {
      const m = load();
      if (!(n in m)) throw new Error('write_failed');
      return self.fault === 'corrupt' ? String(m[n]).slice(0, Math.floor(String(m[n]).length / 2)) : m[n];
    },
    async write(n, text) {
      if (!isOurs(n)) throw new Error('not_ours');
      if (self.fault === 'full') throw Object.assign(new Error('no space'), { code: 'no_space' });
      const m = load(); m[n] = text; save(m);
    },
    async rename(from, to) {
      if (!isOurs(from) || !isOurs(to)) throw new Error('not_ours');
      if (self.fault === 'rename') throw new Error('write_failed');
      const m = load(); m[to] = m[from]; delete m[from]; save(m);
    },
    async remove(n) {
      if (!isOurs(n)) throw new Error('not_ours');
      const m = load(); delete m[n]; save(m);
    },
  };
  return self;
}

/** What Settings says about the state: { tone, key, vars, fix }.
 * tone 'ok' | 'warn' | 'off'; fix is 'pick', 'retry' or null. */
export function backupStatus(state, now = new Date()) {
  if (!state?.on) return { tone: 'off', key: 'autoBackup.off', vars: {}, fix: null };
  if (state.last_error) {
    const fix = state.last_error === 'folder_gone' || state.last_error === 'synced_not_yet' ? 'pick' : 'retry';
    return { tone: 'warn', key: `autoBackup.error.${state.last_error}`, vars: {}, fix };
  }
  if (!state.last_checked_at) return { tone: 'warn', key: 'autoBackup.none', vars: {}, fix: 'retry' };
  const at = new Date(state.last_checked_at);
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const day = todayISO(at);
  const days = Math.round((new Date(`${todayISO(now)}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 86400000);
  const stale = now.getTime() - state.last_checked_at >= STALE_DAYS * 86400000;
  const key = days <= 0 ? 'autoBackup.checkedToday' : days === 1 ? 'autoBackup.checkedYesterday' : 'autoBackup.checkedDays';
  return { tone: stale ? 'warn' : 'ok', key, vars: { time, days }, fix: stale ? 'retry' : null };
}
