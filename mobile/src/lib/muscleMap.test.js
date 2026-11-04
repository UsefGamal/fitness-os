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
  assert.equal(s.get('triceps'), 'secondary');
  assert.equal(s.get('front-deltoids'), 'secondary');
  assert.equal(s.has('quadriceps'), false);
});

test('a group lights all of its outlines', () => {
  const s = shading({ groups: new Set(['Legs']) });
  assert.deepEqual(['quadriceps', 'hamstring', 'gluteal', 'calves'].map((x) => s.get(x)), ['primary', 'primary', 'primary', 'primary']);
  assert.equal(s.has('chest'), false);
});
