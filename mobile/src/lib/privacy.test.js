import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../i18n/en.js';
import { DELETE_WORD, deleteConfirmed, HELP_KEYS, healthIdsToDelete, PRIVACY_KEYS, privacyState } from './privacy.js';

test('ten help answers, each with a question and an answer', () => {
  assert.equal(HELP_KEYS.length, 10);
  for (const k of HELP_KEYS) {
    assert.ok(en[`help.${k}.q`], k);
    assert.ok(en[`help.${k}.a`], k);
  }
});

test('every privacy row has a title, a line and a state', () => {
  const st = privacyState({ workouts: [], body_logs: [], settings: {} });
  for (const k of PRIVACY_KEYS) {
    assert.ok(en[`privacy.${k}.title`] && en[`privacy.${k}.line`], k);
    assert.ok(k in st, k);
  }
});

test('privacyState shows what is on now', () => {
  const st = privacyState({
    workouts: [{ id: 1 }, { id: 2 }], body_logs: [{}], progress_photos: [{}, {}, {}],
    settings: { auto_backup: { on: true }, health: { enabled: true }, notifications: true, photo_lock: false },
  });
  assert.deepEqual([st.phone.workouts, st.phone.weighIns], [2, 1]);
  assert.deepEqual(st.photos, { state: 'on', count: 3, locked: false });
  assert.equal(st.backup.state, 'on');
  assert.equal(st.health.state, 'on');
  assert.equal(st.reminders.state, 'on');
  const none = privacyState({ settings: {} });
  assert.deepEqual([none.backup.state, none.health.state, none.reminders.state, none.photos.state], ['off', 'off', 'off', 'off']);
  assert.equal(none.photos.locked, true);
});

test('Delete everything needs the word typed', () => {
  assert.equal(DELETE_WORD, 'DELETE');
  assert.equal(deleteConfirmed('DELETE'), true);
  assert.equal(deleteConfirmed('  delete '), true);
  for (const bad of ['', 'DELET', 'DELETE!', null, undefined, 'yes']) assert.equal(deleteConfirmed(bad), false);
});

test('Health Connect ids: every workout and every pending delete, once', () => {
  const data = { workouts: [{ id: 3 }, { id: 5 }, { id: 'x' }], settings: { health: { deleted_workouts: [5, 9, -1, 'y'] } } };
  assert.deepEqual(healthIdsToDelete(data).sort((a, b) => a - b), [3, 5, 9]);
  assert.deepEqual(healthIdsToDelete({}), []);
});
