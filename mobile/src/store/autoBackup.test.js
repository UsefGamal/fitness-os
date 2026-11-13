// Automatic backup's store wiring (TEST-1 part C) against the device-test
// build's pretend folder (VITE_FAKE_FS=1): the real store, the real lib.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FOLDER = 'fitness-os-fake-backup-folder';
const GRANT = 'fitness-os-fake-backup-granted';
localStorage.clear();
localStorage.setItem('fitness-os-data-v1', readFileSync(new URL('../lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
localStorage.setItem(FOLDER, JSON.stringify({ 'holiday.jpg': 'JPEG' }));
const { useData } = await import('./useData.js');
const AB = await import('./autoBackup.js');
const folder = () => JSON.parse(localStorage.getItem(FOLDER) || '{}');
const state = () => useData.getState().data.settings.auto_backup;

test('nothing runs before the store is ready, or while it is off', async () => {
  assert.equal(AB.canAutoBackup(), true);
  assert.equal(await AB.maybeBackup(), null, 'not ready yet');
  await useData.getState().hydrate();
  assert.equal(await AB.maybeBackup(), null, 'off');
  assert.deepEqual(await AB.listBackups(), []);
  assert.equal(await AB.readNewestBackup(), null);
});

test('turning it on writes one checked file, today; a second try today does nothing', async () => {
  const out = await AB.pickBackupFolder();
  assert.equal(out.last_error, null);
  const names = Object.keys(folder()).sort();
  assert.equal(names.length, 2);
  assert.match(names[0], /^fitness-os-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(state().on, true);
  assert.ok(!/content:|tree/.test(JSON.stringify(state())), 'no folder address in the data');
  assert.equal(await AB.maybeBackup(), null, 'already checked today');
  assert.equal((await AB.listBackups()).length, 1);
  const text = await AB.readNewestBackup();
  assert.equal(JSON.parse(text).schemaVersion, useData.getState().data.schemaVersion);
});

test('"Back up now" always runs; a revoked folder shows as folder_gone', async () => {
  assert.equal((await AB.backupNow()).last_error, null);
  localStorage.removeItem(GRANT);
  const out = await AB.backupNow();
  assert.equal(out.last_error, 'folder_gone');
  assert.equal(state().last_error, 'folder_gone');
  localStorage.setItem(GRANT, '1');
});

test('turning off with delete removes only the app\'s files', async () => {
  await AB.turnOffBackup({ keepFiles: false });
  assert.deepEqual(Object.keys(folder()), ['holiday.jpg']);
  assert.equal(state().on, false);
  assert.equal(localStorage.getItem(GRANT), null);
});
