import assert from 'node:assert/strict';
import test from 'node:test';

import {
  askPermissionsOnOpen, markPermissionsAsked, makerGuide, reminderChecks, remindersHealthy } from './reminderHealth.js';

test('P14-12: the maker guide for phones that kill apps', () => {
  assert.equal(makerGuide('Xiaomi'), 'xiaomi');
  assert.equal(makerGuide('INFINIX'), 'transsion');
  assert.equal(makerGuide('tecno '), 'transsion');
  assert.equal(makerGuide('Google'), null);
  assert.equal(makerGuide(undefined), null);
});

test('P14-12: each check gets a Fix, unreadable checks are left out', () => {
  const rows = reminderChecks({ notifications: true, exact: false, unrestricted: false, manufacturer: 'Xiaomi' });
  assert.deepEqual(rows.map((r) => [r.key, r.ok, r.fix]), [
    ['notifications', true, 'notifications'], ['exact', false, 'exact'], ['battery', false, 'battery'], ['autostart', null, 'autostart'],
  ]);
  assert.equal(rows.at(-1).guide, 'xiaomi');
  assert.equal(remindersHealthy(rows), false);
  const browser = reminderChecks({});
  assert.deepEqual(browser, []);
  assert.equal(remindersHealthy(browser), true);
  assert.equal(remindersHealthy(reminderChecks({ notifications: true, exact: true, unrestricted: true, manufacturer: 'infinix' })), true);
});

test('permissions are asked once, on the phone, after setup', () => {
  const data = { settings: {} };
  assert.equal(askPermissionsOnOpen({ native: true, data }), true);
  assert.equal(askPermissionsOnOpen({ native: false, data }), false);
  assert.equal(askPermissionsOnOpen({ native: true, data, setup: true }), false);
  assert.equal(askPermissionsOnOpen({ native: true, data: null }), false);
  const asked = markPermissionsAsked(data);
  assert.equal(asked.settings.perms_asked, true);
  assert.equal(askPermissionsOnOpen({ native: true, data: asked }), false);
  assert.equal(data.settings.perms_asked, undefined);
});
