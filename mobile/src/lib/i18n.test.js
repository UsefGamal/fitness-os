import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../i18n/en.js';
import { countLiterals } from '../../scripts/i18n-lint.mjs';
import { addCatalogue, dirOf, locale, localeOf, setLocale, t } from './i18n.js';

test('t() looks up, fills placeholders, and falls back', () => {
  setLocale('en');
  assert.equal(t('tab.home'), 'Home');
  assert.equal(t('about.version', { version: '0.4.1' }), 'Version 0.4.1');
  assert.equal(t('about.version'), 'Version {version}', 'a missing value stays visible');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('another locale falls back to English per key', () => {
  addCatalogue('xx', { 'tab.home': 'Hjem' });
  assert.equal(setLocale('xx'), 'xx');
  assert.equal(locale(), 'xx');
  assert.equal(t('tab.home'), 'Hjem');
  assert.equal(t('tab.plan'), 'Plan');
  assert.equal(setLocale('zz'), 'en', 'an unknown locale is English');
});

test('direction and the locale from the data', () => {
  assert.equal(dirOf('ar'), 'rtl');
  assert.equal(dirOf('ar-EG'), 'rtl');
  assert.equal(dirOf('en'), 'ltr');
  assert.equal(localeOf({ profile: { locale: 'ar' } }), 'ar');
  assert.equal(localeOf({ profile: null }), 'en');
  assert.equal(localeOf(null), 'en');
});

test('every English string is a non-empty string', () => {
  for (const [k, v] of Object.entries(en)) assert.ok(typeof v === 'string' && v.length, k);
});

test('the literal lint counts visible text, not code or comments', () => {
  assert.equal(countLiterals('<div>{t("x")}</div>'), 0);
  assert.equal(countLiterals('<h1>Snapshots</h1>'), 1);
  assert.equal(countLiterals('<button title="Close it" aria-label="x">'), 1);
  assert.equal(countLiterals('// <b>Comment only</b>\n/* <i>Also</i> */'), 0);
  assert.equal(countLiterals('const a = b > c && d < e;'), 0);
  assert.equal(countLiterals('<p>{a}</p><p>Two words</p>'), 1);
});
