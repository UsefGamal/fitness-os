// Which copy wins, atomic writes, snapshots and the backup reminder
// (E2-S3, E2-S4, E2-S11), against a fake filesystem.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { emptyData } from './data.js';
import {
  atomicWrite, BACKUP_EVERY_DAYS, backupDue, loadNewest, parseCopy, parseSnapshotName, pickNewest,
  SNAPSHOT_KEEP, snapshotName, snapshotsToPrune, sortSnapshots, stamp, takeSnapshot,
} from './durable.js';
import { migrate, NewerSchemaError } from './migrate.js';
import { content } from './testContent.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** An in-memory filesystem that can be told to fail on a call. */
function fakeFs({ failOn = null } = {}) {
  const files = new Map();
  const calls = [];
  const maybeFail = (op, path) => {
    calls.push(`${op} ${path}`);
    if (failOn && failOn(op, path)) throw new Error(`fake ${op} failure`);
  };
  return {
    files,
    calls,
    async read(path) { return files.has(path) ? files.get(path) : null; },
    async write(path, text) { maybeFail('write', path); files.set(path, text); },
    async rename(from, to) { maybeFail('rename', to); files.set(to, files.get(from)); files.delete(from); },
    async remove(path) { maybeFail('remove', path); files.delete(path); },
    async list(dir) { return [...files.keys()].filter((k) => k.startsWith(`${dir}/`)); },
  };
}

test('parseCopy only accepts whole JSON objects', () => {
  assert.deepEqual(parseCopy('{"a":1}'), { a: 1 });
  for (const bad of [null, '', '{"a":', '[1]', '3', 'null']) assert.equal(parseCopy(bad), null, String(bad));
});

test('the newest copy wins by saved_at, and a missing one never wins', () => {
  const old = { saved_at: 1, n: 'old' };
  const fresh = { saved_at: 2, n: 'new' };
  assert.equal(pickNewest(old, fresh).data.n, 'new');
  assert.equal(pickNewest(fresh, old).data.n, 'new');
  assert.equal(pickNewest(fresh, old).from, 'local');
  assert.equal(pickNewest(null, old).from, 'file');
  assert.equal(pickNewest(old, null).from, 'local');
  assert.equal(pickNewest(null, null), null);
  // No stamp (written before stamps existed) loses to a stamped copy; a tie goes to the file.
  assert.equal(pickNewest({ n: 'unstamped' }, fresh).data.n, 'new');
  assert.equal(pickNewest({ n: 'local' }, { n: 'file' }).from, 'file');
});

test('a failed localStorage save no longer brings back stale data', () => {
  // localStorage kept an old copy (quota full); the file got the new one.
  const local = JSON.stringify(stamp(migrate(JSON.parse(fixture('v1-empty.json')), content), 1000));
  const newer = { ...migrate(JSON.parse(fixture('v1-yusuf-like.json')), content), saved_at: 2000 };
  const start = loadNewest({ localText: local, fileText: JSON.stringify(newer) }, content);
  assert.equal(start.from, 'file');
  assert.equal(start.data.workouts.length, newer.workouts.length);
  assert.equal(start.snapshotText, null);
});

test('start-up upgrades old data and hands back the exact text to snapshot', () => {
  const text = fixture('v1-yusuf-like.json');
  const start = loadNewest({ localText: text, fileText: null }, content);
  assert.equal(start.data.schemaVersion, 2);
  assert.equal(start.snapshotText, text);
  const fromFile = loadNewest({ localText: null, fileText: text }, content);
  assert.equal(fromFile.snapshotText, text);
  // A corrupt copy is ignored in favour of the readable one.
  assert.equal(loadNewest({ localText: fixture('corrupt-truncated.json'), fileText: text }, content).from, 'file');
  assert.equal(loadNewest({ localText: null, fileText: null }, content), null);
  assert.equal(loadNewest({ localText: 'garbage', fileText: '' }, content), null);
});

test('start-up refuses data from a newer app', () => {
  assert.throws(() => loadNewest({ localText: JSON.stringify({ schemaVersion: 9 }), fileText: null }, content), NewerSchemaError);
});

test('an atomic write never leaves a half-written file in place', async () => {
  const fs = fakeFs();
  await atomicWrite(fs, 'data.json', 'one');
  assert.equal(fs.files.get('data.json'), 'one');
  assert.equal(fs.files.has('data.json.tmp'), false);
  assert.deepEqual(fs.calls, ['write data.json.tmp', 'rename data.json']);

  // The write of the temp file fails: the old file is untouched.
  const failing = fakeFs({ failOn: (op) => op === 'write' });
  failing.files.set('data.json', 'old');
  await assert.rejects(atomicWrite(failing, 'data.json', 'new'));
  assert.equal(failing.files.get('data.json'), 'old');

  // The rename fails: the old file is untouched too.
  const noRename = fakeFs({ failOn: (op) => op === 'rename' });
  noRename.files.set('data.json', 'old');
  await assert.rejects(atomicWrite(noRename, 'data.json', 'new'));
  assert.equal(noRename.files.get('data.json'), 'old');
});

test('snapshot names carry the time and the reason', () => {
  assert.equal(snapshotName('migrate', 1762300000000), 'snapshots/1762300000000-migrate.json');
  assert.deepEqual(parseSnapshotName('snapshots/1762300000000-import.json'), { name: 'snapshots/1762300000000-import.json', at: 1762300000000, reason: 'import', label: 'Before an import' });
  assert.equal(parseSnapshotName('1762300000000-weird.json').label, 'Snapshot');
  assert.equal(parseSnapshotName('1762300000000-weird.json').name, 'snapshots/1762300000000-weird.json');
  assert.equal(parseSnapshotName('snapshots/notes.txt'), null);
  assert.equal(parseSnapshotName('snapshots/1762300000000-x.json.tmp'), null);
});

test('only the newest seven snapshots are kept', async () => {
  const fs = fakeFs();
  fs.files.set('snapshots/readme.txt', 'not a snapshot');
  for (let i = 1; i <= 9; i += 1) await takeSnapshot(fs, `{"n":${i}}`, i % 2 ? 'import' : 'migrate', 1762300000000 + i * 1000);
  const kept = sortSnapshots(await fs.list('snapshots'));
  assert.equal(kept.length, SNAPSHOT_KEEP);
  assert.equal(kept[0].at, 1762300009000);
  assert.equal(kept.at(-1).at, 1762300003000);
  assert.ok(fs.files.has('snapshots/readme.txt'), 'other files are left alone');
  assert.deepEqual(snapshotsToPrune(['snapshots/1-a.json'].map((n) => n.replace('1-', '1762300000001-'))), []);
});

test('a backup reminder after 14 days, not before, and not on an empty phone', () => {
  const DAY = 86400000;
  const now = new Date(2026, 10, 20, 12).getTime();
  const empty = emptyData(content);
  assert.equal(backupDue(empty, now), null);

  const started = { ...empty, body_logs: [{ id: 1, log_date: '2026-11-10', weight_kg: 80 }] };
  assert.equal(backupDue(started, now), null, '10 days in, never backed up: not yet');
  const longer = { ...empty, workouts: [{ id: 1, log_date: '2026-09-01', sets: [] }] };
  assert.deepEqual(backupDue(longer, now), { days: null });

  const backedUp = (daysAgo) => ({ ...longer, settings: { ...longer.settings, last_backup_at: now - daysAgo * DAY } });
  assert.equal(backupDue(backedUp(BACKUP_EVERY_DAYS - 1), now), null);
  assert.deepEqual(backupDue(backedUp(BACKUP_EVERY_DAYS), now), { days: BACKUP_EVERY_DAYS });

  // "Later" hides it for three days.
  const snoozed = { ...backedUp(20), settings: { ...backedUp(20).settings, backup_snoozed_at: now - DAY } };
  assert.equal(backupDue(snoozed, now), null);
  assert.deepEqual(backupDue({ ...snoozed, settings: { ...snoozed.settings, backup_snoozed_at: now - 4 * DAY } }, now), { days: 20 });
});
