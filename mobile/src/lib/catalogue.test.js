import assert from 'node:assert/strict';
import test from 'node:test';

import { entryFor, filterCatalogue, groupOf, groupsOf } from './catalogue.js';
import { content } from './testContent.js';

const E = (id, name, primary, equipment = 'barbell', secondary = []) => ({ id, name, primary, secondary, equipment, instructions: [], photos: [] });
const entries = [
  E('Barbell_Squat', 'Barbell Squat', ['quadriceps'], 'barbell', ['glutes']),
  E('Pushups', 'Pushups', ['chest'], 'body only', ['triceps']),
  E('Wide-Grip_Lat_Pulldown', 'Wide-Grip Lat Pulldown', ['lats'], 'cable'),
  E('Plank', 'Plank', ['abdominals'], 'body only'),
];
const byId = new Map(entries.map((e) => [e.id, e]));

test('dataset muscles fold into the six groups', () => {
  assert.equal(groupOf(entries[0]), 'Legs');
  assert.equal(groupOf(entries[2]), 'Back');
  assert.deepEqual([...groupsOf(entries[1])].sort(), ['Arms', 'Chest']);
});

test('search needs every word, and filters by group and equipment', () => {
  assert.deepEqual(filterCatalogue(entries, { q: 'lat pull' }).map((e) => e.id), ['Wide-Grip_Lat_Pulldown']);
  assert.deepEqual(filterCatalogue(entries, { q: 'quadriceps' }).map((e) => e.id), ['Barbell_Squat']);
  assert.deepEqual(filterCatalogue(entries, { equipment: 'body only' }).map((e) => e.id), ['Pushups', 'Plank']);
  assert.deepEqual(filterCatalogue(entries, { group: 'Core' }).map((e) => e.id), ['Plank']);
});

test('our exercises find their photos through the curated mapping, then by name', () => {
  assert.equal(entryFor('Lat Pulldown', content.training, byId).id, 'Wide-Grip_Lat_Pulldown');
  assert.equal(entryFor('Back Squat', content.training, byId).id, 'Barbell_Squat');
  assert.equal(entryFor('plank', content.training, byId).id, 'Plank');
  assert.equal(entryFor('Tibia Wall', content.training, byId), null);
});

test('every plan exercise with a mapping points at a real name in our content', () => {
  const ours = new Set(content.training.exercise_library.map((x) => x[1]));
  JSON.stringify(content.training, (k, v) => { if (k === 'name' && typeof v === 'string') ours.add(v); return v; });
  const stray = Object.keys(content.training.exercise_photos).filter((n) => !ours.has(n));
  assert.deepEqual(stray, []);
});

test('filters by a finer muscle and an angle, and search finds them', () => {
  const more = [...entries, E('Incline_DB', 'Incline Dumbbell Press', ['chest'], 'dumbbell'), E('Side_Lateral_Raise', 'Side Lateral Raise', ['shoulders'], 'dumbbell'), E('Face_Pull', 'Face Pull', ['shoulders'], 'cable')];
  assert.deepEqual(filterCatalogue(more, { muscle: 'rear delts' }).map((e) => e.id), ['Face_Pull']);
  assert.deepEqual(filterCatalogue(more, { group: 'Chest', angle: 'upper_chest' }).map((e) => e.id), ['Incline_DB']);
  assert.deepEqual(filterCatalogue(more, { q: 'side delts' }).map((e) => e.id), ['Side_Lateral_Raise']);
  assert.deepEqual(filterCatalogue(more, { q: 'upper chest' }).map((e) => e.id), ['Incline_DB']);
});
