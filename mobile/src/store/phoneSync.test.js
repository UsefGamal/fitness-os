// Health Connect sync, step by step (audit AND-1): a removed "read weight"
// permission no longer stops workouts from being shared, and nothing that
// failed is marked done.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Capacitor } from '@capacitor/core';

Capacitor.getPlatform = () => 'android';
const calls = [];
let refuse = new Set();
globalThis.__capacitorPlugins.Health = {
  readWeights: async () => { calls.push('readWeights'); if (refuse.has('weights')) throw new Error('SecurityException'); return { weights: [] }; },
  writeWorkouts: async ({ workouts }) => { calls.push(`writeWorkouts:${workouts.length}`); if (refuse.has('workouts')) throw new Error('SecurityException'); return {}; },
  deleteWorkouts: async () => ({}),
  readDaily: async () => ({ days: [] }),
};
localStorage.clear();
const data = JSON.parse(readFileSync(new URL('../lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
data.settings = { ...data.settings, health: { enabled: true, weights_since: 5, workouts_since: 0 } };
localStorage.setItem('fitness-os-data-v1', JSON.stringify(data));
const { useData } = await import('./useData.js');
const { syncHealth, healthSettings } = await import('./phoneSync.js');
await useData.getState().hydrate();
const h = () => healthSettings(useData.getState().data);

test('read weight refused: workouts are still shared, weights are tried again next time', async () => {
  refuse = new Set(['weights']);
  await assert.rejects(syncHealth(), /read weight/);
  assert.ok(calls.some((c) => c.startsWith('writeWorkouts:') && c !== 'writeWorkouts:0'), calls.join(', '));
  assert.equal(h().weights_since, 5, 'not marked done');
  assert.ok(h().workouts_since > 0, 'workouts are');
});

test('write refused: the weigh-ins still come in, workouts are tried again next time', async () => {
  refuse = new Set(['workouts']);
  useData.getState().update((d) => ({ ...d, settings: { ...d.settings, health: { ...healthSettings(d), workouts_since: 0 } } }));
  await assert.rejects(syncHealth(), /workouts/);
  assert.equal(h().workouts_since, 0);
  assert.ok(h().weights_since > 5);
});

test('both allowed: a normal sync', async () => {
  refuse = new Set();
  const r = await syncHealth();
  assert.equal(typeof r.weighIns, 'number');
  assert.ok(h().workouts_since > 0);
});
