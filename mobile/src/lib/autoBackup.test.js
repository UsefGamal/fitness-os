import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { bigFixture } from '../../e2e/bigFixture.mjs';
import { autoState, backupDueNow, backupHealthy, backupName, backupStatus, backupText, dateRange, ERRORS, fakeFolder, isOurs, KEEP_DAILY, newestBackup, OURS, provesBackup, runBackup, toPrune, withAutoState } from './autoBackup.js';
import { decryptWithPassphrase, isEncrypted, makeRecovery, newDataKey } from './backupCrypto.js';
import { dataHash } from './dataCheck.js';
import { parseDataFile, summarize, toDataFile } from './dataFile.js';
import { addDays } from './dates.js';
import en from '../i18n/en.js';
import { migrate } from './migrate.js';
import { content } from './testContent.js';

const v1 = () => JSON.parse(readFileSync(new URL('./fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
const yusuf = () => migrate(v1(), content);
const NOW = new Date(2026, 10, 13, 8, 14);
const TODAY = '2026-11-13';

test('names: only dated backups of ours match, nothing else in a folder does', () => {
  assert.equal(backupName(TODAY), 'fitness-os-backup-2026-11-13.json');
  for (const ok of ['fitness-os-backup-2026-11-13.json', 'fitness-os-backup-2026-11-13.json.enc', 'fitness-os-backup-2026-11-13.json.tmp', 'fitness-os-backup-2026-11-13.json.enc.tmp']) assert.ok(isOurs(ok), ok);
  for (const no of ['holiday.jpg', 'fitness-os-backup-notes.txt', 'fitness-os-backup-2026-11-13.json.bak', 'fitness-os-backup-2026-11-13 (1).json', 'x-fitness-os-backup-2026-11-13.json', '../fitness-os-backup-2026-11-13.json', 'fitness-os-backup-2026-11-13.json/x', '', null, 7]) assert.ok(!isOurs(no), String(no));
  assert.ok(!OURS.test('fitness-os-backup-2026-11-13.json.tmp'));
});

test('the saved state is read with safe defaults and never trusts odd values', () => {
  assert.deepEqual(autoState({ settings: {} }), { on: false });
  assert.deepEqual(autoState({ settings: { auto_backup: [] } }), { on: false });
  const s = autoState({ settings: { auto_backup: { on: 'yes', last_name: '../../x', last_error: 'boom', last_checked_at: 'x', uri: 'content://secret' } } });
  assert.deepEqual(s, { on: false, folder: null, last_checked_at: null, last_name: null, last_hash: null, last_error: null });
  assert.ok(!('uri' in s));
});

test('a normal day: one checked file, compact, restores to the same data', async () => {
  const data = yusuf();
  const folder = fakeFolder({ 'holiday.jpg': 'JPEG' });
  const state = await runBackup(folder, data, content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, null);
  assert.equal(state.last_name, backupName(TODAY));
  assert.equal(state.last_checked_at, NOW.getTime());
  assert.equal(state.last_hash, dataHash(data));
  assert.equal(state.folder, 'Fitness OS');
  assert.deepEqual(Object.keys(folder.files).sort(), [backupName(TODAY), 'holiday.jpg']);
  const text = folder.files[backupName(TODAY)];
  assert.ok(!text.includes('\n'));
  assert.ok(text.length < toDataFile(data, NOW).length);
  assert.deepEqual(summarize(parseDataFile(text, content)), summarize(data));
  assert.ok(!/progress-photos\/.*base64|data:image/.test(text));
});

test('a second run the same day does nothing; a change the next day is due', async () => {
  const data = yusuf();
  const state = await runBackup(fakeFolder(), data, content, { now: NOW, state: { on: true } });
  const saved = withAutoState(data, state);
  assert.equal(dataHash(saved), dataHash(data), 'recording the backup is not a change');
  assert.equal(backupDueNow(autoState(saved), saved, NOW), false);
  assert.equal(backupDueNow(autoState(saved), saved, new Date(2026, 10, 13, 23, 59)), false);
  const tomorrow = new Date(2026, 10, 14, 7, 0);
  assert.equal(backupDueNow(autoState(saved), saved, tomorrow), false, 'nothing logged since');
  const more = { ...saved, body_logs: [...saved.body_logs, { id: 9999, log_date: '2026-11-14', weight_kg: 99 }] };
  assert.equal(backupDueNow(autoState(more), more, tomorrow), true);
  assert.equal(backupDueNow(autoState(more), more, NOW), false, 'at most one a day');
  assert.equal(backupDueNow({ on: false }, more, tomorrow), false);
  assert.equal(backupDueNow({ on: true }, more, tomorrow), true, 'the first one');
});

test('folder revoked: an error to show, nothing written', async () => {
  const folder = fakeFolder({}, { fault: 'revoked' });
  const state = await runBackup(folder, yusuf(), content, { now: NOW, state: { on: true, folder: 'Fitness OS' } });
  assert.equal(state.last_error, 'folder_gone');
  assert.equal(state.on, true);
  assert.deepEqual(folder.files, {});
  const thrown = { ...fakeFolder(), status: async () => { throw new Error('gone'); } };
  assert.equal((await runBackup(thrown, yusuf(), content, { now: NOW })).last_error, 'folder_gone');
});

test('a cloud-synced folder without a key waits for the passphrase: no plain file leaves the phone', async () => {
  const folder = fakeFolder({}, { fault: 'synced' });
  const state = await runBackup(folder, yusuf(), content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, 'needs_passphrase');
  assert.deepEqual(folder.files, {});
  assert.equal(backupStatus(state, NOW).fix, 'passphrase');
});

test('a cloud-synced folder with the key: an encrypted, proven .json.enc and nothing readable', async () => {
  const folder = fakeFolder({ 'holiday.jpg': 'x', 'fitness-os-backup-notes.txt': 'y' }, { fault: 'synced' });
  const data = yusuf();
  const { key, kid } = newDataKey();
  const recovery = await makeRecovery(key, 'correct horse battery', { rounds: 1000 });
  const state = await runBackup(folder, data, content, { now: NOW, state: { on: true }, keys: { key, kid, recovery } });
  assert.equal(state.last_error, null);
  assert.equal(state.last_name, 'fitness-os-backup-2026-11-13.json.enc');
  const text = folder.files['fitness-os-backup-2026-11-13.json.enc'];
  assert.ok(isEncrypted(text));
  assert.ok(!text.includes('weight_kg') && !text.includes('log_date'), 'nothing readable');
  assert.ok(!('fitness-os-backup-2026-11-13.json' in folder.files), 'no plain copy');
  assert.equal(folder.files['holiday.jpg'], 'x');
  // The recovery passphrase alone restores it (a new phone).
  assert.ok(provesBackup(await decryptWithPassphrase(text, 'correct horse battery'), data, content));
});

test('a cloud-synced folder: a read-back that does not decrypt is thrown away', async () => {
  const folder = fakeFolder({}, { fault: 'synced' });
  const { key, kid } = newDataKey();
  const recovery = await makeRecovery(key, 'correct horse battery', { rounds: 1000 });
  const write = folder.write;
  folder.write = (n, text) => write(n, text.replace(/"data":"(.)/, (m, c) => `"data":"${c === 'A' ? 'B' : 'A'}`));
  const state = await runBackup(folder, yusuf(), content, { now: NOW, state: { on: true }, keys: { key, kid, recovery } });
  assert.equal(state.last_error, 'check_failed');
  assert.deepEqual(folder.files, {});
});

test('disk full on write: the earlier good backup stays, no .tmp is left', async () => {
  const data = yusuf();
  const folder = fakeFolder();
  const first = await runBackup(folder, data, content, { now: new Date(2026, 10, 12, 9), state: { on: true } });
  folder.fault = 'full';
  const state = await runBackup(folder, data, content, { now: NOW, state: first });
  assert.equal(state.last_error, 'no_space');
  assert.equal(state.last_name, first.last_name);
  assert.equal(state.last_checked_at, first.last_checked_at);
  assert.deepEqual(Object.keys(folder.files), ['fitness-os-backup-2026-11-12.json']);
  assert.equal(backupDueNow(state, data, NOW), true, 'a failed day is tried again');
});

test('the write succeeds but reads back different: refused, bad file removed, old ones kept and not pruned', async () => {
  const data = yusuf();
  const files = { 'fitness-os-backup-notes.txt': 'mine' };
  for (let i = 1; i <= 12; i += 1) files[backupName(addDays(TODAY, -i))] = 'old';
  const folder = fakeFolder(files, { fault: 'corrupt' });
  const state = await runBackup(folder, data, content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, 'check_failed');
  assert.equal(Object.keys(folder.files).length, 13, 'nothing pruned after a failed check');
  assert.ok(!(backupName(TODAY) in folder.files));
  assert.ok(!Object.keys(folder.files).some((n) => n.endsWith('.tmp')));
});

test('a rename that fails is a failed backup, and today is not recorded', async () => {
  const folder = fakeFolder({}, { fault: 'rename' });
  const state = await runBackup(folder, yusuf(), content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, 'write_failed');
  assert.deepEqual(folder.files, {});
});

test('provesBackup refuses a truncated file, another person\'s data and non-backups', () => {
  const data = yusuf();
  const text = backupText(data, NOW);
  assert.equal(provesBackup(text, data, content), true);
  assert.equal(provesBackup(text.slice(0, -40), data, content), false);
  assert.equal(provesBackup('{}', data, content), false);
  const other = { ...data, workouts: data.workouts.map((w, i) => (i ? w : { ...w, sets: w.sets.map((s, j) => (j ? s : { ...s, reps: (s.reps || 0) + 1 })) })) };
  assert.equal(provesBackup(backupText(other, NOW), data, content), false, 'same counts, one rep changed');
});

test('rotation over 60 days: 7 daily plus the newest of 4 older weeks; strangers are never listed', () => {
  const names = ['holiday.jpg', 'fitness-os-backup-notes.txt', 'fitness-os-backup-2026-11-13 (1).json', 'fitness-os-backup-2026-11-01.json.tmp', 'fitness-os-backup-2027-01-01.json'];
  for (let i = 0; i < 60; i += 1) names.push(backupName(addDays(TODAY, -i)));
  const gone = toPrune(names, TODAY);
  for (const g of gone) assert.ok(isOurs(g), g);
  assert.ok(gone.includes('fitness-os-backup-2026-11-01.json.tmp'), 'a stale .tmp of ours goes');
  assert.ok(!gone.includes('fitness-os-backup-2027-01-01.json'), 'a file from the future is left alone');
  const kept = names.filter((n) => OURS.test(n) && n <= backupName(TODAY) && !gone.includes(n)).sort().reverse();
  assert.equal(kept.length, KEEP_DAILY + 4);
  assert.deepEqual(kept.slice(0, 7), Array.from({ length: 7 }, (_, i) => backupName(addDays(TODAY, -i))));
  // 13 Nov 2026 is a Friday; the 7 dailies reach back to Sat 7 Nov. The
  // weekly keeps are the newest older file of each of four weeks.
  assert.deepEqual(kept.slice(7), ['2026-11-06', '2026-10-31', '2026-10-24', '2026-10-17'].map(backupName));
  assert.deepEqual(toPrune(kept, TODAY), [], 'pruning again removes nothing');
  assert.deepEqual(toPrune(['holiday.jpg', null, 5], TODAY), []);
});

test('rotation runs after a good backup and leaves other files in the folder alone', async () => {
  const data = yusuf();
  const files = { 'holiday.jpg': 'JPEG', 'fitness-os-backup-notes.txt': 'mine' };
  for (let i = 1; i <= 59; i += 1) files[backupName(addDays(TODAY, -i))] = 'old';
  const folder = fakeFolder(files);
  const state = await runBackup(folder, data, content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, null);
  const left = Object.keys(folder.files);
  assert.ok(left.includes('holiday.jpg') && left.includes('fitness-os-backup-notes.txt'));
  assert.equal(left.filter((n) => OURS.test(n)).length, 11);
  assert.equal(newestBackup(left), backupName(TODAY));
  assert.equal(newestBackup(['holiday.jpg']), null);
});

test('the fake folder itself refuses names that are not ours', async () => {
  const folder = fakeFolder({ 'holiday.jpg': 'JPEG' });
  await assert.rejects(folder.remove('holiday.jpg'));
  await assert.rejects(folder.write('notes.txt', 'x'));
  await assert.rejects(folder.rename('fitness-os-backup-2026-11-13.json.tmp', 'holiday.jpg'));
  assert.deepEqual(folder.files, { 'holiday.jpg': 'JPEG' });
});

test('healthy means on, no error and checked in the last 3 days', () => {
  const at = NOW.getTime();
  assert.equal(backupHealthy({ on: true, last_checked_at: at, last_error: null }, at + 2 * 86400000), true);
  assert.equal(backupHealthy({ on: true, last_checked_at: at, last_error: null }, at + 4 * 86400000), false);
  assert.equal(backupHealthy({ on: true, last_checked_at: at, last_error: 'folder_gone' }, at), false);
  assert.equal(backupHealthy({ on: false }, at), false);
  assert.equal(backupHealthy({ on: true }, at), false);
});

test('every error has plain words and a fix in Settings', () => {
  for (const e of ERRORS) assert.ok(en[`autoBackup.error.${e}`], e);
});

test('dateRange gives the first and last log dates', () => {
  const r = dateRange(yusuf());
  assert.ok(r.first <= r.last);
  assert.match(r.first, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dateRange({ workouts: [], body_logs: [], meal_logs: [] }), null);
});

test('size and speed guard: three years fit in 3 MB and restore fast', async () => {
  const big = migrate(bigFixture('2026-11-06', 3), content);
  const text = backupText(big, NOW);
  assert.ok(text.length < 3 * 1024 * 1024, `${Math.round(text.length / 1024)} KB`);
  const t0 = performance.now();
  const back = parseDataFile(text, content);
  const ms = performance.now() - t0;
  // The target is 300 ms; CI machines vary, so the bar is 5x that. The
  // point is to notice a tenfold regression, not to time a phone.
  assert.ok(ms < 1500, `${Math.round(ms)} ms`);
  assert.equal(dataHash(back), dataHash(big));
  const state = await runBackup(fakeFolder(), big, content, { now: NOW, state: { on: true } });
  assert.equal(state.last_error, null);
});

test('the status line: off, checked today with its time, stale, and each error with its fix', () => {
  assert.deepEqual(backupStatus({ on: false }, NOW), { tone: 'off', key: 'autoBackup.off', vars: {}, fix: null });
  assert.deepEqual(backupStatus({ on: true, last_checked_at: NOW.getTime(), last_error: null }, new Date(2026, 10, 13, 21)), { tone: 'ok', key: 'autoBackup.checkedToday', vars: { time: '08:14', days: 0 }, fix: null });
  assert.equal(backupStatus({ on: true, last_checked_at: NOW.getTime(), last_error: null }, new Date(2026, 10, 14, 7)).key, 'autoBackup.checkedYesterday');
  const stale = backupStatus({ on: true, last_checked_at: NOW.getTime(), last_error: null }, new Date(2026, 10, 18, 7));
  assert.deepEqual([stale.tone, stale.key, stale.vars.days, stale.fix], ['warn', 'autoBackup.checkedDays', 5, 'retry']);
  assert.equal(backupStatus({ on: true, last_error: 'folder_gone' }, NOW).fix, 'pick');
  assert.equal(backupStatus({ on: true, last_error: 'synced_not_yet' }, NOW).fix, 'pick');
  assert.equal(backupStatus({ on: true, last_error: 'no_space' }, NOW).fix, 'retry');
  assert.equal(backupStatus({ on: true }, NOW).key, 'autoBackup.none');
  for (const key of ['autoBackup.off', 'autoBackup.none', 'autoBackup.checkedToday', 'autoBackup.checkedYesterday', 'autoBackup.checkedDays']) assert.ok(en[key], key);
});
