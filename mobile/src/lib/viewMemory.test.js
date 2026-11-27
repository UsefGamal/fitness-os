import { test } from 'node:test';
import assert from 'node:assert/strict';

import { forgetViews, recall, remember } from './viewMemory.js';

test('a screen gets back what it showed, and the fallback before that', () => {
  forgetViews();
  assert.equal(recall('/library#tab', 'mine'), 'mine');
  remember('/library#tab', 'all');
  assert.equal(recall('/library#tab', 'mine'), 'all');
  remember('/library#muscle', null);
  assert.equal(recall('/library#muscle', 'chest'), null); // a saved null is a choice ("All")
});

test('a value saved for a day is dropped the next day', () => {
  forgetViews();
  remember('/plan#day', '2026-11-29', '2026-11-27');
  assert.equal(recall('/plan#day', null, '2026-11-27'), '2026-11-29');
  assert.equal(recall('/plan#day', null, '2026-11-28'), null);
  assert.equal(recall('/plan#day', null), null);
});

test('only the newest 200 screens are kept, and forgetting clears them', () => {
  forgetViews();
  for (let i = 0; i < 205; i += 1) remember(`k${i}`, i);
  assert.equal(recall('k0', 'gone'), 'gone');
  assert.equal(recall('k204', 'gone'), 204);
  remember('k5', 'again'); // saving again makes it the newest
  remember('new', 1);
  assert.equal(recall('k5', 'gone'), 'again');
  forgetViews();
  assert.equal(recall('k204', 'gone'), 'gone');
});
