import assert from 'node:assert/strict';
import test from 'node:test';

import { homeLine, homeOrder, whatsNewMode } from './interrupts.js';

test("What's new never covers a session that is still due", () => {
  assert.equal(whatsNewMode({ hasNews: false, sessionDue: true }), null);
  assert.equal(whatsNewMode({ hasNews: false, sessionDue: false }), null);
  assert.equal(whatsNewMode({ hasNews: true, sessionDue: true }), 'line');
  assert.equal(whatsNewMode({ hasNews: true, sessionDue: false }), 'sheet');
});

test('Home shows one thin line at most, and never the same backup ask twice', () => {
  assert.equal(homeLine({ news: true, backup: true, firstWeekAsksBackup: false }), 'news');
  assert.equal(homeLine({ news: false, backup: true, firstWeekAsksBackup: false }), 'backup');
  assert.equal(homeLine({ news: false, backup: true, firstWeekAsksBackup: true }), null);
  assert.equal(homeLine({ news: false, backup: false, firstWeekAsksBackup: false }), null);
});

test("Home: Today's ticks before the weight on a training day, the weight first on a rest day", () => {
  assert.equal(homeOrder({ trainingDay: true }), 'today');
  assert.equal(homeOrder({ trainingDay: false }), 'weight');
});
