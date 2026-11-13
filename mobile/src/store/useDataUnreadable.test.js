// A copy that exists but can't be read: the recovery screen, never Setup
// over the top of it (TEST-1 part C).
import assert from 'node:assert/strict';
import test from 'node:test';

const KEY = 'fitness-os-data-v1';
localStorage.clear();
localStorage.setItem(KEY, '{"schemaVersion":3,"workouts":[{"id":1');
const { useData } = await import('./useData.js');

test('unreadable: startError, the raw text kept for saving, then a snapshot restores', async () => {
  await useData.getState().hydrate();
  const s = useData.getState();
  assert.equal(s.startError, 'unreadable');
  assert.equal(s.rawCopies.length, 1);
  s.update((d) => ({ ...d, workouts: [] }));
  assert.equal(localStorage.getItem(KEY), '{"schemaVersion":3,"workouts":[{"id":1', 'nothing written while blocked');
  await s.recoverFrom(JSON.stringify({ schemaVersion: 3, saved_at: 5, workouts: [] }));
  assert.equal(useData.getState().startError, null);
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).workouts, []);
  const files = JSON.parse(localStorage.getItem('fitness-os-fake-fs') || '{}');
  assert.ok(Object.keys(files).some((k) => k.startsWith('snapshots/')), 'the unreadable text is kept as a snapshot');
});
