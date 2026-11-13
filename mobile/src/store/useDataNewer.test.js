// Data from a newer app version is never overwritten (TEST-1 part C).
import assert from 'node:assert/strict';
import test from 'node:test';

const KEY = 'fitness-os-data-v1';
const newer = JSON.stringify({ schemaVersion: 99, saved_at: Date.now(), workouts: [{ id: 1 }] });
localStorage.clear();
localStorage.setItem(KEY, newer);
const { flushSave, useData } = await import('./useData.js');

test('newer data: an error to show, and nothing is written', async () => {
  await useData.getState().hydrate();
  assert.ok(useData.getState().loadError, 'loadError is set');
  useData.getState().update((d) => ({ ...d, workouts: [] }));
  flushSave(true);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(localStorage.getItem(KEY), newer, 'untouched');
  assert.equal(localStorage.getItem('fitness-os-fake-fs'), null, 'no file written');
});
