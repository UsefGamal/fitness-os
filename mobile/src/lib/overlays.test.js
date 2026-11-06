import assert from 'node:assert/strict';
import test from 'node:test';

import { closeTopOverlay, overlayCount, pushOverlay } from './overlays.js';

test('back closes the newest overlay first, then nothing is left', () => {
  const closed = [];
  const offA = pushOverlay(() => closed.push('a'));
  const offB = pushOverlay(() => closed.push('b'));
  assert.equal(overlayCount(), 2);
  assert.equal(closeTopOverlay(), true);
  assert.deepEqual(closed, ['b']);
  offB();
  assert.equal(closeTopOverlay(), true);
  assert.deepEqual(closed, ['b', 'a']);
  offA();
  offA();
  assert.equal(overlayCount(), 0);
  assert.equal(closeTopOverlay(), false);
});
