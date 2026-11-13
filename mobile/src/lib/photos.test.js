import assert from 'node:assert/strict';
import test from 'node:test';

import { addPhoto, beforeAfter, cacheGet, cachePut, fitSize, PHOTO_CACHE_MAX, removePhoto, timeline } from './photos.js';

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

test('the photo cache keeps the 6 most recently used and drops the oldest', () => {
  const c = new Map();
  for (let i = 1; i <= PHOTO_CACHE_MAX; i += 1) cachePut(c, `p${i}`, i);
  assert.equal(cacheGet(c, 'p1'), 1); // p1 is now the newest
  cachePut(c, 'p7', 7);
  assert.equal(c.size, PHOTO_CACHE_MAX);
  assert.equal(c.has('p2'), false);
  assert.equal(c.has('p1'), true);
  assert.equal(cacheGet(c, 'p2'), undefined);
  cachePut(c, 'p7', 70); // a second put replaces, never grows
  assert.equal(c.size, PHOTO_CACHE_MAX);
  assert.equal(cacheGet(c, 'p7'), 70);
  assert.equal(cachePut(new Map(), 'a', 1, 0).size, 0);
});
