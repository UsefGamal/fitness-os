import assert from 'node:assert/strict';
import test from 'node:test';

import { FLAGS, flagOn, routesFor } from './flags.js';

const routes = [{ path: '/' }, { path: '/lab', flag: 'example_lab' }, { path: '/gone', flag: 'not_a_flag' }];

test('flags are on in debug builds and off in release until they ship', () => {
  assert.equal(flagOn('example_lab', { release: false }), true);
  assert.equal(flagOn('example_lab', { release: true }), false);
  assert.equal(flagOn('not_a_flag', { release: false }), false);
});

test('a flagged route is absent from release builds', () => {
  assert.deepEqual(routesFor(routes, { release: true }).map((r) => r.path), ['/']);
  assert.deepEqual(routesFor(routes, { release: false }).map((r) => r.path), ['/', '/lab']);
});

test('a shipped flag reaches release', () => {
  FLAGS.shipped_thing = { release: true };
  try {
    assert.equal(flagOn('shipped_thing', { release: true }), true);
  } finally {
    delete FLAGS.shipped_thing;
  }
});
