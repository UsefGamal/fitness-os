import assert from 'node:assert/strict';
import test from 'node:test';

import { collectNativeCrashes, currentReport, readErrors, recordError } from './errors.js';

test('errors go into a ring in localStorage, and a broken ring reads as empty', () => {
  localStorage.clear();
  assert.deepEqual(readErrors(), []);
  recordError(new Error('boom'));
  recordError('plain text');
  const ring = readErrors();
  assert.equal(ring.length, 2);
  assert.match(JSON.stringify(ring), /boom/);
  localStorage.setItem('fitness-os-errors', '{"not":"a list"}');
  assert.deepEqual(readErrors(), []);
  localStorage.setItem('fitness-os-errors', 'nonsense');
  assert.deepEqual(readErrors(), []);
});

test('native crash lines join the ring once', async () => {
  localStorage.clear();
  globalThis.__capacitorPlugins.Crash = { take: () => ({ crashes: [] }) };
  assert.equal(await collectNativeCrashes(), 0);
});

test('the bug report names the app and holds no personal data', () => {
  localStorage.clear();
  recordError(new Error('weight 81.4 kg failed'));
  const text = JSON.stringify(currentReport());
  assert.match(text, /web/);
  assert.ok(!/usef|@gmail/i.test(text));
});
