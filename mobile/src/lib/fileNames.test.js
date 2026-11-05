import assert from 'node:assert/strict';
import test from 'node:test';

import { alternateName } from './fileNames.js';

test('adds the time before the extension', () => {
  const now = new Date(2026, 10, 5, 7, 26, 9);
  assert.equal(alternateName('training-week-2026-11-01.html', now), 'training-week-2026-11-01-072609.html');
  assert.equal(alternateName('notes', now), 'notes-072609');
});
