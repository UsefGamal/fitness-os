import assert from 'node:assert/strict';
import test from 'node:test';

import { SAVE_OK, recordSave } from './saveHealth.js';

test('one good copy is enough', () => {
  let s = recordSave(SAVE_OK, 'local', false, { hasFile: true, now: 1 });
  assert.equal(s.failing, false, 'the file has not answered yet');
  s = recordSave(s, 'file', true, { hasFile: true, now: 2 });
  assert.equal(s.failing, false);
});

test('both copies failing raises the warning, with when it started', () => {
  let s = recordSave(SAVE_OK, 'local', false, { hasFile: true, now: 1 });
  s = recordSave(s, 'file', false, { hasFile: true, now: 2 });
  assert.equal(s.failing, true);
  assert.equal(s.since, 2);
  s = recordSave(s, 'local', false, { hasFile: true, now: 9 });
  assert.equal(s.since, 2, 'keeps the first failure time');
});

test('the next good write clears it', () => {
  let s = recordSave(SAVE_OK, 'local', false, { hasFile: true });
  s = recordSave(s, 'file', false, { hasFile: true });
  s = recordSave(s, 'file', true, { hasFile: true });
  assert.equal(s.failing, false);
  assert.equal(s.since, null);
});

test('in a browser (no file mirror) localStorage alone decides', () => {
  assert.equal(recordSave(SAVE_OK, 'local', false).failing, true);
  assert.equal(recordSave(SAVE_OK, 'local', true).failing, false);
});
