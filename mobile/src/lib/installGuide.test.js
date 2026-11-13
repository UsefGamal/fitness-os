import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../i18n/en.js';
import { guideFor, INSTALL_GUIDE } from './installGuide.js';

test('three phone families, 3 to 5 steps each, every string present', () => {
  assert.deepEqual(INSTALL_GUIDE.map((b) => b.key), ['samsung', 'xiaomi', 'transsion']);
  for (const b of INSTALL_GUIDE) {
    assert.ok(en[b.title], b.title);
    assert.ok(b.steps.length >= 3 && b.steps.length <= 5, b.key);
    for (const s of b.steps) {
      assert.ok(en[s.key], s.key);
      assert.ok(en[s.label], s.label);
      assert.ok(['file', 'switch', 'button', 'over'].includes(s.card), s.card);
    }
  }
});

test('every family ends on "install over the old one, never uninstall"', () => {
  for (const b of INSTALL_GUIDE) {
    assert.equal(b.steps.at(-1).key, 'install.step.update');
    assert.ok(b.steps.some((s) => s.key === 'install.step.protect'), b.key);
  }
  assert.match(en['install.step.update'], /uninstall/i);
});

test('guideFor falls back to the first family', () => {
  assert.equal(guideFor('xiaomi').key, 'xiaomi');
  assert.equal(guideFor('nokia').key, 'samsung');
  assert.equal(guideFor(undefined).key, 'samsung');
});
