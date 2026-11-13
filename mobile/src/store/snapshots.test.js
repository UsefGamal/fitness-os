// Store tests run under node with scripts/node-stubs (TEST-1 part C):
// VITE_FAKE_FS=1, so the private folder is the in-memory fake.
import assert from 'node:assert/strict';
import test from 'node:test';

import { SNAPSHOT_KEEP } from '../lib/durable.js';
import { listSnapshots, readSnapshot, snapshot } from './snapshots.js';

test('a snapshot is kept, listed newest first, and read back', async () => {
  localStorage.clear();
  const a = await snapshot(JSON.stringify({ schemaVersion: 3, saved_at: 1, workouts: [] }), 'import');
  assert.ok(a, 'a name comes back');
  assert.equal(await snapshot('', 'import'), null, 'nothing to keep');
  const list = await listSnapshots();
  assert.equal(list.length, 1);
  assert.deepEqual(JSON.parse(await readSnapshot(list[0].name)).workouts, []);
  assert.equal(await readSnapshot('snapshots/missing.json'), null);
});

test('only the newest few are kept', async () => {
  localStorage.clear();
  for (let i = 0; i < SNAPSHOT_KEEP + 3; i += 1) await snapshot(JSON.stringify({ schemaVersion: 3, saved_at: i, n: i }), `r${i}`);
  assert.ok((await listSnapshots()).length <= SNAPSHOT_KEEP);
});

test('a broken file in the folder is not offered as a snapshot copy', async () => {
  localStorage.clear();
  const name = await snapshot(JSON.stringify({ schemaVersion: 3, saved_at: 1 }), 'update');
  const store = JSON.parse(localStorage.getItem('fitness-os-fake-fs'));
  store[name] = '{"cut off';
  localStorage.setItem('fitness-os-fake-fs', JSON.stringify(store));
  assert.equal(await readSnapshot(name), null);
});
