import assert from 'node:assert/strict';
import test from 'node:test';

import { addPhoto, beforeAfter, fitSize, removePhoto, timeline } from './photos.js';

test('photos group by date and give a before/after per pose', () => {
  let d = {};
  d = addPhoto(d, { date: '2026-09-01', pose: 'front', file: 'a.jpg' });
  d = addPhoto(d, { date: '2026-11-01', pose: 'front', file: 'b.jpg' });
  d = addPhoto(d, { date: '2026-11-01', pose: 'side', file: 'c.jpg' });
  const t = timeline(d);
  assert.deepEqual(t.map((x) => x.date), ['2026-11-01', '2026-09-01']);
  assert.equal(t[0].photos.side.file, 'c.jpg');
  assert.deepEqual([beforeAfter(d, 'front').before.file, beforeAfter(d, 'front').after.file], ['a.jpg', 'b.jpg']);
  assert.equal(beforeAfter(d, 'side'), null);
  assert.equal(removePhoto(d, 1).progress_photos.length, 2);
});

test('photos are scaled down, never up', () => {
  assert.deepEqual(fitSize(4000, 3000), { width: 1280, height: 960 });
  assert.deepEqual(fitSize(800, 600), { width: 800, height: 600 });
});
