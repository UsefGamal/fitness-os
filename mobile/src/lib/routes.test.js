import { test } from 'node:test';
import assert from 'node:assert/strict';

import { INTERVAL_PRESETS } from './training.js';
import { linkRoute, reminderRoute } from './routes.js';

test('widget links open only the three screens', () => {
  assert.equal(linkRoute('fitnessos://open/workout'), '/workout');
  assert.equal(linkRoute('fitnessos://open/plan/'), '/plan');
  assert.equal(linkRoute('fitnessos://open/meals'), '/meals');
  for (const bad of ['fitnessos://open/constructor', 'fitnessos://open/toString', 'fitnessos://open/plan/../../snapshots',
    'fitnessos://open/settings', 'https://open/plan', 'fitnessos://open/', '', null, undefined, 42]) {
    assert.equal(linkRoute(bad), null, String(bad));
  }
});

test('reminder taps open only routes the app schedules', () => {
  for (const ok of ['/workout', '/meals', '/plan', '/session/recovery', ...INTERVAL_PRESETS.map((p) => `/intervals?preset=${p.key}`)]) {
    assert.equal(reminderRoute(ok), ok, ok);
  }
  for (const bad of ['/snapshots', '/settings', '/photos', '//evil.example', '/workout/../snapshots', '/intervals?preset=x&y=1',
    'https://evil.example', '', null, {}]) {
    assert.equal(reminderRoute(bad), null, String(bad));
  }
});
