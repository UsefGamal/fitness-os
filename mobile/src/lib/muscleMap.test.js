import assert from 'node:assert/strict';
import test from 'node:test';

import { MUSCLE_GROUP } from './catalogue.js';
import { GROUP_OF_SHAPE, SHAPES_OF, shading } from './muscleMap.js';

test('every catalogue muscle has an outline, and every outline a group', () => {
  for (const m of Object.keys(MUSCLE_GROUP)) assert.ok(SHAPES_OF[m]?.length, m);
  for (const shapes of Object.values(SHAPES_OF)) for (const s of shapes) assert.ok(GROUP_OF_SHAPE[s], s);
});

test('main muscles are bright, helpers dim, and main wins', () => {
  const s = shading({ primary: ['chest'], secondary: ['shoulders', 'triceps', 'chest'] });
  assert.equal(s.get('chest'), 'primary');
  assert.equal(s.get('triceps-long'), 'secondary');
  assert.equal(s.get('triceps-lateral'), 'secondary');
  assert.equal(s.get('front-deltoids'), 'secondary');
  assert.equal(s.has('quadriceps'), false);
});

test('a group lights all of its outlines', () => {
  const s = shading({ groups: new Set(['Legs']) });
  assert.deepEqual(['quadriceps', 'hamstring', 'gluteal', 'calves'].map((x) => s.get(x)), ['primary', 'primary', 'primary', 'primary']);
  assert.equal(s.has('chest'), false);
});

test('a thumbnail zooms to the figure and area where the main muscle is drawn (UX-09)', async () => {
  const { zoomBox, BACK_DX } = await import('./muscleMap.js');
  const front = [['chest', ['40 40 60 40 60 60 40 60']], ['abs', ['45 60 55 60 55 100 45 100']]];
  const back = [['lats', ['30 50 70 50 70 80 30 80']], ['chest', ['49 49 51 49 51 51 49 51']]];
  // Chest: mostly on the front. A 20 x 20 box, padded, at least 46 wide, centred on it.
  assert.deepEqual(zoomBox(new Map([['chest', 'primary'], ['abs', 'secondary']]), front, back), { x: 27, y: 27, size: 46 });
  // Lats: only on the back figure, which starts BACK_DX to the right.
  assert.deepEqual(zoomBox(new Map([['lats', 'primary']]), front, back), { x: BACK_DX + 23, y: 38, size: 54 });
  // Only helpers lit: zoom to those. Nothing lit: no zoom.
  assert.deepEqual(zoomBox(new Map([['abs', 'secondary']]), front, back), { x: 23, y: 53, size: 54 });
  assert.equal(zoomBox(new Map(), front, back), null);
  assert.equal(zoomBox(new Map([['calves', 'primary']]), front, back), null);
});
