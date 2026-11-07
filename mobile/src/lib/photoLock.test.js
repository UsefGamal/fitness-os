import assert from 'node:assert/strict';
import test from 'node:test';

import { LOCKED, photoLockOn, photoLockStep, photosOpen, RELOCK_MS, setPhotoLock } from './photoLock.js';

test('P14-13: the lock is on by default and can be switched off', () => {
  assert.equal(photoLockOn({ settings: {} }), true);
  assert.equal(photoLockOn(setPhotoLock({ settings: {} }, false)), false);
});

test('P14-13: Photos re-locks 60 s after leaving, not before', () => {
  let s = photoLockStep(LOCKED, 'unlock', 0);
  assert.equal(photosOpen(s, 0), true);
  s = photoLockStep(s, 'leave', 1000);
  assert.equal(photosOpen(s, 1000 + RELOCK_MS - 1), true);
  assert.equal(photosOpen(s, 1000 + RELOCK_MS), false);
  // Back within the grace: still open, and the clock resets.
  const back = photoLockStep(s, 'return', 30000);
  assert.deepEqual(back, { unlocked: true, leftAt: null, external: false });
  // Back after it: locked.
  assert.deepEqual(photoLockStep(s, 'return', 1000 + RELOCK_MS), LOCKED);
  // A second leave keeps the first time.
  assert.equal(photoLockStep(s, 'leave', 50000).leftAt, 1000);
});

test("P14-13: the app's own camera or file picker doesn't count as leaving", () => {
  let s = photoLockStep(LOCKED, 'unlock', 0);
  s = photoLockStep(s, 'external', 10);
  s = photoLockStep(s, 'leave', 20);
  assert.equal(s.leftAt, null);
  s = photoLockStep(s, 'return', 20 + 5 * RELOCK_MS);
  assert.deepEqual(s, { unlocked: true, leftAt: null, external: false });
  assert.equal(photosOpen(s, 20 + 5 * RELOCK_MS), true);
});

test('P14-13: locked stays locked; lock and unknown events', () => {
  assert.equal(photosOpen(LOCKED, 0), false);
  assert.equal(photosOpen(photoLockStep(LOCKED, 'return', 0), 0), false);
  assert.deepEqual(photoLockStep(photoLockStep(LOCKED, 'unlock'), 'lock'), LOCKED);
  assert.deepEqual(photoLockStep(undefined, 'nothing'), LOCKED);
  assert.equal(photosOpen(null), false);
});
