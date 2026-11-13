import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import en from '../i18n/en.js';
import { pageOf, ROOT_PAGES, ROOT_ROWS, SETTINGS_PAGES } from './settingsPages.js';

test('the Settings root keeps to 10 rows (E5-S1)', () => {
  assert.ok(ROOT_ROWS <= 10, String(ROOT_ROWS));
});

test('every page has a unique key, its strings, and a section in Settings.jsx', () => {
  const keys = SETTINGS_PAGES.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  const view = readFileSync(new URL('../views/Settings.jsx', import.meta.url), 'utf8');
  for (const p of SETTINGS_PAGES) {
    assert.ok(en[p.title] && en[p.note], p.key);
    assert.ok(view.includes(`show('${p.key}')`), `Settings.jsx renders ${p.key}`);
  }
  assert.equal(pageOf('nope'), null);
  assert.equal(pageOf('data').key, 'data');
});

test('the install guide is a page but not a root row; Share is the last root row (UPD-1)', () => {
  assert.equal(pageOf('install').key, 'install');
  assert.ok(!ROOT_PAGES.some((p) => p.key === 'install'));
  assert.equal(ROOT_ROWS, ROOT_PAGES.length + 3);
  assert.equal(ROOT_ROWS, 10);
  const view = readFileSync(new URL('../views/Settings.jsx', import.meta.url), 'utf8');
  assert.ok(view.includes("navigate('/settings/install')"));
  assert.ok(view.includes('ROOT_PAGES.map'));
});
