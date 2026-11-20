import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../i18n/en.js';
import { REST_TIPS, restTip } from './restTips.js';

test('every rest tip has words, short enough for the timer screen', () => {
  for (const k of REST_TIPS) {
    assert.ok(en[k], k);
    assert.ok(en[k].length <= 90, k);
  }
});

test('one rest keeps its tip; the next rest gets another', () => {
  assert.equal(restTip(1000), restTip(1000));
  assert.notEqual(restTip(1000), restTip(1001));
  assert.ok(REST_TIPS.includes(restTip(-7)));
  assert.ok(REST_TIPS.includes(restTip(undefined)));
});
