import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import en from '../i18n/en.js';
import { pageOf, ROOT_ROWS, searchSettings, SETTINGS_GROUPS, SETTINGS_INDEX, SETTINGS_PAGES } from './settingsPages.js';

const tr = (k) => en[k] || k;
const view = readFileSync(new URL('../views/Settings.jsx', import.meta.url), 'utf8');

test('the hub has six categories in two groups', () => {
  assert.equal(SETTINGS_GROUPS.length, 2);
  assert.equal(ROOT_ROWS, 6);
  for (const g of SETTINGS_GROUPS) {
    assert.ok(en[g.label], g.label);
    for (const r of g.rows) assert.ok(en[r.title] && en[r.note], r.key);
  }
});

test('every page has a unique key, its strings, and a section in Settings.jsx', () => {
  const keys = SETTINGS_PAGES.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of SETTINGS_PAGES) {
    assert.ok(en[p.title] && en[p.note], p.key);
    assert.ok(view.includes(`show('${p.key}')`), `Settings.jsx renders ${p.key}`);
  }
  assert.equal(pageOf('nope'), null);
  assert.equal(pageOf('data').key, 'data');
});

test('the old page links still open (Today links to safety, setup to data)', () => {
  for (const k of ['data', 'training', 'times', 'health', 'safety', 'modules', 'about', 'install', 'help', 'privacy']) assert.ok(pageOf(k), k);
  assert.ok(view.includes("navigate('/settings/install')"));
});

test('every search entry has its label and a page that exists', () => {
  for (const item of SETTINGS_INDEX) {
    assert.ok(en[item.label], item.label);
    const key = item.to.startsWith('/settings/') ? item.to.slice(10) : null;
    if (key) assert.ok(pageOf(key), item.to);
  }
});

test('search matches the start of words in the label or its other words', () => {
  assert.deepEqual(searchSettings('', tr), []);
  assert.deepEqual(searchSettings('   ', tr), []);
  const rest = searchSettings('rest', tr).map((x) => x.label);
  assert.deepEqual(rest.slice(0, 3), ['set.restBig', 'set.restSmall', 'set.autoRest']);
  assert.ok(searchSettings('DARK', tr).some((x) => x.label === 'theme.title'));
  assert.ok(searchSettings('hevy', tr).some((x) => x.label === 'set.importStrong'));
  assert.deepEqual(searchSettings('rest zebra', tr), []);
  // A word typed must start a word, not sit inside one.
  assert.ok(!searchSettings('ackup', tr).length);
});

test('label matches come before other-word matches', () => {
  const r = searchSettings('drive', tr).map((x) => x.label);
  assert.deepEqual(r, ['set.autoBackup']);
  const restore = searchSettings('restore', tr).map((x) => x.label);
  assert.ok(restore.includes('set.importBackup'));
  const sounds = searchSettings('sound', tr).map((x) => x.label);
  assert.equal(sounds[0], 'set.sounds');
});
