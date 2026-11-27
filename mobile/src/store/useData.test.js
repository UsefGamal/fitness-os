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

test('DATA-2: a snapshot that cannot be saved stops an import, and nothing is replaced', async () => {
  const had = useData.getState().data.workouts.length;
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { if (k === FS && v.includes('snapshots/')) throw new Error('QuotaExceededError'); real(k, v); };
  try {
    const done = await useData.getState().replaceAll({ ...useData.getState().data, workouts: [{ id: 1 }, { id: 2 }, { id: 3 }] }, 'import');
    assert.equal(done, false);
    assert.equal(useData.getState().data.workouts.length, had);
  } finally {
    localStorage.setItem = real;
  }
  assert.equal(await useData.getState().replaceAll({ ...useData.getState().data }, 'import'), true);
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

// Last: after this the store never saves again (HELP-1, Delete everything).
test('stopSaving drops what is waiting and writes nothing after', async () => {
  const { stopSaving } = await import('./useData.js');
  useData.getState().update((d) => ({ ...d, settings: { ...d.settings, water_goal_ml: 3100 } }));
  flushSave(); // localStorage now, the mirror 300 ms later
  stopSaving(); // cancels that mirror write
  await tick(400);
  assert.notEqual(JSON.parse(files()['fitness-os-data.json']).settings.water_goal_ml, 3100, 'the waiting mirror write was dropped');
  localStorage.removeItem(KEY);
  useData.getState().update((d) => ({ ...d, settings: { ...d.settings, water_goal_ml: 3200 } }));
  flushSave(true);
  await tick(400);
  assert.equal(localStorage.getItem(KEY), null, 'nothing written back');
  assert.notEqual(JSON.parse(files()['fitness-os-data.json']).settings.water_goal_ml, 3200);
});
