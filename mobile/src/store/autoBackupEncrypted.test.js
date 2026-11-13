// Encrypted backup to a cloud folder, through the store (BAK-1 part 2):
// the pretend folder acts as a synced one, its key sits in localStorage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FOLDER = 'fitness-os-fake-backup-folder';
const KEYS = 'fitness-os-fake-backup-key';
const PASS = 'blue kettle seven hills';
localStorage.clear();
localStorage.setItem('fitness-os-data-v1', readFileSync(new URL('../lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
localStorage.setItem('fitness-os-fake-backup-synced', '1');
const { useData } = await import('./useData.js');
const AB = await import('./autoBackup.js');
const folder = () => JSON.parse(localStorage.getItem(FOLDER) || '{}');

test('a cloud folder waits for the passphrase and writes nothing', async () => {
  await useData.getState().hydrate();
  const out = await AB.pickBackupFolder();
  assert.equal(out.last_error, 'needs_passphrase');
  assert.deepEqual(folder(), {});
});

test('setting the passphrase writes an encrypted file and proves it with the passphrase', async () => {
  const out = await AB.setRecoveryPassphrase(PASS);
  assert.equal(out.ok, true);
  assert.ok(out.ms >= 0);
  const names = Object.keys(folder());
  assert.equal(names.length, 1);
  assert.match(names[0], /\.json\.enc$/);
  assert.ok(!folder()[names[0]].includes('log_date'));
  assert.ok(localStorage.getItem(KEYS), 'the key is kept');
});

test('unlock: plain passes through, this phone opens its own file, a new phone needs the passphrase', async () => {
  assert.equal(await AB.unlockBackup('{"plain":1}'), '{"plain":1}');
  const text = await AB.readNewestBackup();
  assert.equal(JSON.parse(await AB.unlockBackup(text)).schemaVersion, useData.getState().data.schemaVersion);
  localStorage.removeItem(KEYS);
  assert.equal(await AB.unlockBackup(text), null, 'asks for the passphrase');
  await assert.rejects(AB.unlockBackup(text, 'wrong one entirely'), (e) => e.code === 'wrong_passphrase');
  assert.ok(JSON.parse(await AB.unlockBackup(text, PASS)).workouts);
});

test('with the key gone, the next backup asks for a passphrase again; a failed test restore turns nothing on', async () => {
  const out = await AB.backupNow();
  assert.equal(out.last_error, 'needs_passphrase');
  // The folder breaks during set-up: the key is dropped again.
  localStorage.removeItem('fitness-os-fake-backup-granted');
  const bad = await AB.setRecoveryPassphrase(PASS);
  assert.equal(bad.ok, false);
  assert.equal(localStorage.getItem(KEYS), null);
  localStorage.setItem('fitness-os-fake-backup-granted', '1');
  await AB.turnOffBackup({ keepFiles: true });
  assert.equal(useData.getState().data.settings.auto_backup.on, false);
});
