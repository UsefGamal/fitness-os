// The save path (TEST-1 part C), with the real store under node: the file
// mirror is the in-memory fake folder (VITE_FAKE_FS=1).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CURRENT_SCHEMA } from '../lib/migrate.js';

const KEY = 'fitness-os-data-v1';
const FS = 'fitness-os-fake-fs';
const v1 = readFileSync(new URL('../lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8');
const files = () => JSON.parse(localStorage.getItem(FS) || '{}');
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// localStorage holds an old v1 copy; the file mirror has nothing yet.
localStorage.clear();
localStorage.setItem(KEY, v1);
const { flushSave, useData } = await import('./useData.js');

test('start: the v1 copy is upgraded, a snapshot is kept, both stores catch up', async () => {
  const s = useData.getState();
  assert.equal(s.data.schemaVersion, CURRENT_SCHEMA, 'first paint is already upgraded');
  await s.hydrate();
  const after = useData.getState();
  assert.equal(after.ready, true);
  assert.equal(after.startError, null);
  // The mirror coalesces writes for 300 ms.
  await tick(400);
  const f = files();
  assert.ok(Object.keys(f).some((k) => k.startsWith('snapshots/')), 'a snapshot before the upgrade');
  assert.equal(JSON.parse(f['fitness-os-data.json']).schemaVersion, CURRENT_SCHEMA, 'the mirror file is written');
  assert.equal(JSON.parse(localStorage.getItem(KEY)).schemaVersion, CURRENT_SCHEMA, 'localStorage is upgraded');
});

test('a change lands in localStorage and in the file once flushed', async () => {
  useData.getState().update((d) => ({ ...d, settings: { ...d.settings, water_goal_ml: 2600 } }));
  assert.equal(JSON.parse(localStorage.getItem(KEY)).settings.water_goal_ml, undefined, 'not yet: saves are coalesced');
  flushSave(true);
  await tick(50);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).settings.water_goal_ml, 2600);
  assert.equal(JSON.parse(files()['fitness-os-data.json']).settings.water_goal_ml, 2600);
  assert.equal(useData.getState().saveFailing, false);
});

test('replaceAll keeps a snapshot of what was there and writes at once', async () => {
  const before = Object.keys(files()).filter((k) => k.startsWith('snapshots/')).length;
  const next = { ...useData.getState().data, workouts: [] };
  await useData.getState().replaceAll(next, 'import');
  await tick(50);
  assert.ok(Object.keys(files()).filter((k) => k.startsWith('snapshots/')).length >= Math.min(before + 1, 7));
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).workouts, []);
});

test('localStorage full: the file still saves and the bar shows once both fail', async () => {
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { if (k === KEY) throw new Error('QuotaExceededError'); real(k, v); };
  try {
    useData.getState().update((d) => ({ ...d, settings: { ...d.settings, water_goal_ml: 2700 } }));
    flushSave(true);
    await tick(50);
    assert.equal(JSON.parse(files()['fitness-os-data.json']).settings.water_goal_ml, 2700, 'the file has it');
  } finally {
    localStorage.setItem = real;
  }
  useData.getState().retrySave();
  await tick(50);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).settings.water_goal_ml, 2700, 'retry catches up');
  assert.equal(useData.getState().saveFailing, false);
});
