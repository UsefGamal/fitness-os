import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { emptyData } from './data.js';
import { canonical, checkCounts, checkLine, dataHash, fnv1a, parseStartLine, stampVersion, startLine, versionChanged } from './dataCheck.js';
import { parseDataFile, toDataFile } from './dataFile.js';
import { backfillEaten, tickMeal, mealDayFor } from './meals.js';
import { migrate } from './migrate.js';
import { content } from './testContent.js';

const v1 = () => JSON.parse(readFileSync(new URL('./fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));
const yusuf = () => migrate(v1(), content);

test('the hash is 8 hex characters and the known FNV-1a values hold', () => {
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('foobar'), 0xbf9cf968);
  assert.match(dataHash(yusuf()), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.match(dataHash({}), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.match(dataHash(null), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test('key order does not matter; what was logged does', () => {
  const d = yusuf();
  const shuffled = Object.fromEntries(Object.entries(d).reverse());
  shuffled.workouts = d.workouts.map((w) => Object.fromEntries(Object.entries(w).reverse()));
  assert.equal(dataHash(shuffled), dataHash(d));
  const edited = { ...d, workouts: d.workouts.map((w, i) => (i === 0 ? { ...w, sets: w.sets.map((s, j) => (j === 0 ? { ...s, reps: (s.reps || 0) + 1 } : s)) } : w)) };
  assert.notEqual(dataHash(edited), dataHash(d));
  assert.notEqual(dataHash({ ...d, body_logs: d.body_logs.slice(1) }), dataHash(d));
  // The order of logged rows is part of the data.
  assert.notEqual(dataHash({ ...d, body_logs: [...d.body_logs].reverse() }), dataHash(d));
});

test('things that change by themselves do not move the hash', () => {
  const d = yusuf();
  const h = dataHash(d);
  assert.equal(dataHash({ ...d, saved_at: 123 }), h);
  assert.equal(dataHash({ ...d, settings: { ...d.settings, notifications: true, app_version: '9.9.9' } }), h);
  assert.equal(dataHash({ ...d, health_daily: [{ date: '2026-11-01', steps: 9000 }] }), h);
  assert.equal(dataHash({ ...d, achievements: { first: '2026-11-01' } }), h);
  assert.equal(dataHash({ ...d, schemaVersion: 99 }), h);
  // A new field with an empty default, as an upgrade would add.
  assert.equal(dataHash({ ...d, workouts: d.workouts.map((w) => ({ ...w, sets: w.sets.map((s) => ({ ...s, group: null, added_kg: null })) })), new_list: [], new_flag: false }), h);
});

test('an upgrade keeps the hash: v1 to current, twice, a backup round trip, and the meal backfill', () => {
  const d = yusuf();
  assert.equal(dataHash(migrate(d, content)), dataHash(d));
  assert.equal(dataHash(parseDataFile(toDataFile(d), content)), dataHash(d));
  // DA-1's copied numbers are worked out, so ticking is seen but the copy is not.
  const day = '2026-11-04';
  const option = mealDayFor(day, content.nutrition).meals[0].options[0];
  const ticked = tickMeal(emptyData(content), day, 'breakfast', option, true);
  const old = { ...ticked, meal_logs: ticked.meal_logs.map(({ eaten: _e, ...m }) => m) };
  assert.equal(dataHash(backfillEaten(old, content.nutrition)), dataHash(old));
  assert.equal(dataHash(ticked), dataHash(old));
  assert.notEqual(dataHash(ticked), dataHash(emptyData(content)));
});

test('the line shows the counts with thousands separators', () => {
  const d = yusuf();
  const c = checkCounts(d);
  assert.equal(checkLine(d), `W ${c.workouts} · S ${c.sets} · M ${c.meals} · B ${c.weighIns} · ${dataHash(d)}`);
  const big = { workouts: Array.from({ length: 1234 }, (_, i) => ({ id: i, sets: [{}, {}] })), meal_logs: [], body_logs: [] };
  assert.match(checkLine(big), /^W 1,234 · S 2,468 · M 0 · B 0 · /);
  assert.match(checkLine(null), /^W 0 · S 0 · M 0 · B 0 · /);
});

test('canonical sorts keys and drops empty values', () => {
  assert.deepEqual(JSON.stringify(canonical({ b: 1, a: { d: null, c: [] }, e: [{ z: false, y: 2 }], f: '' })), '{"b":1,"e":[{"y":2}]}');
  assert.equal(JSON.stringify(canonical({ a: 1, eaten: 2 }, ['eaten'])), '{"a":1}');
  // 0 is a real value.
  assert.equal(JSON.stringify(canonical({ weight_kg: 0 })), '{"weight_kg":0}');
});

test('a snapshot is due when another version last opened real data', () => {
  const d = yusuf();
  assert.equal(versionChanged(d, 'dev'), false);
  assert.equal(versionChanged(d, '0.9.8'), true); // never stamped, has data
  const stamped = stampVersion(d, '0.9.8');
  assert.equal(stamped.settings.app_version, '0.9.8');
  assert.equal(versionChanged(stamped, '0.9.8'), false);
  assert.equal(versionChanged(stamped, '0.9.9'), true);
  assert.equal(stampVersion(stamped, '0.9.8'), stamped);
  assert.equal(stampVersion(d, 'dev'), d);
  // A brand-new install has nothing worth a snapshot.
  assert.equal(versionChanged(emptyData(content), '0.9.8'), false);
  assert.equal(dataHash(stamped), dataHash(d));
});

test('the start line round-trips, and an error is not a pass', () => {
  const d = yusuf();
  const ok = startLine({ version: '0.9.8', data: d });
  assert.deepEqual(parseStartLine(ok), { ok: true, version: '0.9.8', line: checkLine(d) });
  assert.deepEqual(parseStartLine(startLine({ version: '0.9.8', error: 'unreadable' })), { ok: false, version: '0.9.8', line: 'unreadable' });
  assert.equal(parseStartLine('nonsense'), null);
});
