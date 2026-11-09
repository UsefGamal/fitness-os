import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { DATA_KEYS, ImportError, isPhotoFile, keepSafety, loosenedGates, MAX_FILE_BYTES, parseDataFile, SHARE_FORMAT, SHARE_OMITS, summarize, toDataFile, toShareCopy } from './dataFile.js';
import { content } from './testContent.js';

// The shape the old site's Settings > "Download my data" produces.
const SERVER_EXPORT = {
  format: 'fitness-os-export',
  version: 1,
  exported_at: '2026-11-04T11:51:51Z',
  profile: { id: 1, height_cm: 173, goal_weight_low_kg: 75 },
  exercises: [{ id: 7, name: 'Leg Press', muscle_group: 'Legs', equipment: 'Machine' }],
  body_logs: [{ id: 2, log_date: '2026-10-30', weight_kg: 82 }, { id: 1, log_date: '2026-10-01', weight_kg: 84 }],
  hydration_logs: [],
  workouts: [{ id: 3, log_date: '2026-10-29', workout_type: 'gym', notes: 'Pull', sets: [{ id: 9, workout_id: 3, exercise_id: 7, set_number: 1, reps: 10, weight_kg: 60, rpe: 8 }], checklist_items: [] }],
  meal_logs: [{ id: 1, log_date: '2026-10-29', meal_slot: 'breakfast', completed: true, option_key: 'option_a', drink_key: null }],
  bonus_logs: [],
};

test('imports the old site export, keeping its ids and adding missing exercises', () => {
  const data = parseDataFile(JSON.stringify(SERVER_EXPORT), content);
  assert.equal(data.exercises[0].id, 7);
  assert.ok(data.exercises.length > 1);
  assert.equal(new Set(data.exercises.map((e) => e.id)).size, data.exercises.length);
  assert.deepEqual(data.body_logs.map((b) => b.log_date), ['2026-10-01', '2026-10-30']);
  assert.equal(data.workouts[0].sets[0].exercise_id, 7);
  assert.deepEqual(summarize(data), { weighIns: 2, workouts: 1, sets: 1, meals: 1 });
});

test('a backup made by the app imports back to the same data', () => {
  const data = parseDataFile(JSON.stringify(SERVER_EXPORT), content);
  assert.deepEqual(parseDataFile(toDataFile(data), content), data);
  const empty = emptyData(content);
  assert.deepEqual(parseDataFile(toDataFile(empty), content), empty);
});

test('later fields (moved sessions, notes, badges) survive a backup', () => {
  const data = { ...parseDataFile(JSON.stringify(SERVER_EXPORT), content), session_moves: [{ from: '2026-11-03', to: '2026-11-04', key: 'push' }], exercise_notes: { 'Leg Press': 'Seat 5' }, achievements: { first: '2026-11-04' }, evening_plan: { monday: 'tabata' }, progress_photos: [{ id: 1, date: '2026-11-04', pose: 'front', file: 'progress-photos/1.jpg' }] };
  assert.deepEqual(parseDataFile(toDataFile(data), content), data);
});

test('rejects files that are not a Fitness OS export', () => {
  assert.throws(() => parseDataFile('not json', content), ImportError);
  assert.throws(() => parseDataFile('{"format":"other"}', content), ImportError);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, version: 99 }), content), ImportError);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, schemaVersion: 3 }), content), /newer version/);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, workouts: null }), content), ImportError);
});

// ── P14-10: a hostile backup can't hurt ──────────────────────────────

const hostile = (extra) => JSON.stringify({ ...JSON.parse(toDataFile(emptyData(content))), ...extra });

test('a file over 10 MB is refused before it is parsed', () => {
  const big = `{"format":"fitness-os-export","pad":"${'x'.repeat(MAX_FILE_BYTES)}"}`;
  assert.throws(() => parseDataFile(big, content), (e) => e instanceof ImportError && /too big/.test(e.message));
});

test('photo entries that point outside the photos folder are dropped', () => {
  const good = { id: 1, date: '2026-11-01', pose: 'front', file: 'progress-photos/2026-11-01-front-1730000000000.jpg' };
  const bad = [
    { id: 2, date: '2026-11-01', pose: 'side', file: 'fitness-os-data.json' },
    { id: 3, date: '2026-11-01', pose: 'back', file: 'progress-photos/../fitness-os-data.json' },
    { id: 4, date: '2026-11-01', pose: 'back', file: 'snapshots/1-import.json' },
    { id: 5, date: '2026-11-01', pose: 'back', file: '/data/data/com.usefgamal.fitnessos/files/x.jpg' },
    { id: 6, date: '2026-11-01', pose: 'back', file: null },
    'not an object',
  ];
  const d = parseDataFile(hostile({ progress_photos: [good, ...bad] }), content);
  assert.deepEqual(d.progress_photos, [good]);
  assert.equal(isPhotoFile(good.file), true);
  for (const b of bad) assert.equal(isPhotoFile(b?.file), false);
});

test('unknown keys go into the _unknown bag, prototype keys are dropped', () => {
  const text = hostile({ a_key_from_the_future: { kept: true }, blob: 'x'.repeat(100) }).replace('{', '{"__proto__":{"polluted":true},"constructor":1,');
  const d = parseDataFile(text, content);
  assert.equal(d.a_key_from_the_future, undefined);
  assert.equal(d.blob, undefined);
  assert.deepEqual(d._unknown, { a_key_from_the_future: { kept: true }, blob: 'x'.repeat(100) });
  assert.equal(Object.hasOwn(d, '__proto__'), false);
  assert.equal(Object.hasOwn(d, 'constructor'), false);
  assert.equal({}.polluted, undefined);
  // Still lossless: the bag goes out with the next export and comes back.
  assert.deepEqual(parseDataFile(toDataFile(d), content)._unknown, d._unknown);
});

test('every top-level key the app writes is a known key', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dirs = ['lib', 'store', 'views', 'components'].map((d) => new URL(`../${d}/`, import.meta.url));
  const written = new Set();
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      if (!/\.jsx?$/.test(f) || f.includes('.test.')) continue;
      const src = readFileSync(new URL(f, dir), 'utf8');
      for (const m of src.matchAll(/\.\.\.(?:data|d|next|prev|cur|base|raw), ([a-z_]+):/g)) written.add(m[1]);
      for (const m of src.matchAll(/\bout\.([a-z_]+) = /g)) if (f === 'migrate.js') written.add(m[1]);
    }
  }
  for (const k of Object.keys(emptyData(content))) written.add(k);
  const missing = [...written].filter((k) => !DATA_KEYS.has(k) && !['gender', 'kicker', 'status', 'format'].includes(k));
  assert.deepEqual(missing, [], 'add these to DATA_KEYS in dataFile.js');
});

test('an import that loosens a safety limit is flagged, and the phone answers can be kept', () => {
  const here = emptyData(content);
  here.safety = { ...here.safety, gates: { ...here.safety.gates, no_deficit: true }, hide_kcal: true };
  const file = emptyData(content);
  assert.deepEqual(loosenedGates(here, file), ['no_deficit', 'hide_kcal']);
  assert.deepEqual(loosenedGates(file, here), [], 'tightening asks nothing');
  assert.deepEqual(loosenedGates(here, here), []);
  assert.deepEqual(keepSafety(here, file).safety, here.safety);
  assert.equal(keepSafety(here, file).workouts, file.workouts);
});

test('P14-14: a shared copy leaves out health data and can\'t be restored', () => {
  const data = { ...parseDataFile(JSON.stringify(SERVER_EXPORT), content), health_daily: { '2026-11-04': { steps: 9000 } }, progress_photos: [{ id: 1, date: '2026-11-04', pose: 'front', file: 'progress-photos/1.jpg' }], _unknown: { x: 1 } };
  const copy = JSON.parse(toShareCopy(data, new Date('2026-11-07T08:00:00Z')));
  assert.equal(copy.format, SHARE_FORMAT);
  assert.equal(copy.restorable, false);
  assert.match(copy.note, /can't be restored/);
  assert.equal(copy.exported_at, '2026-11-07T08:00:00Z');
  for (const k of [...SHARE_OMITS, '_unknown', 'saved_at', 'version']) assert.equal(k in copy, false, k);
  assert.ok(Array.isArray(copy.workouts) && copy.workouts.length === 1);
  assert.ok(Array.isArray(copy.meal_logs));
  assert.equal(JSON.stringify(copy).includes('9000'), false);
  assert.throws(() => parseDataFile(JSON.stringify(copy), content), (e) => e instanceof ImportError && /can't be restored/.test(e.message));
  // The full backup is untouched and lossless.
  assert.deepEqual(parseDataFile(toDataFile(data), content), data);
  assert.equal(data.health_daily['2026-11-04'].steps, 9000);
});

test('pentest JS-01: a shared copy keeps only the plan, workouts and meals', () => {
  const data = {
    ...parseDataFile(JSON.stringify(SERVER_EXPORT), content),
    profile: { birth_date: '1990-01-01', height_cm: 180 },
    goals: [{ start_weight_kg: 103 }],
    diet: { ramadan: { start: '2027-02-18' } },
    setup: { minor: true },
    checkins: [{ date: '2026-11-01' }],
  };
  data.workouts = data.workouts.map((w) => ({ ...w, pain_note: 'left knee' }));
  const copy = JSON.parse(toShareCopy(data));
  for (const k of ['profile', 'goals', 'diet', 'setup', 'checkins', 'settings', 'safety', 'body_logs', 'hydration_logs', 'health_daily', 'progress_photos']) {
    assert.equal(k in copy, false, k);
    assert.ok(SHARE_OMITS.includes(k), k);
  }
  assert.ok(copy.workouts.length > 0);
  assert.equal(JSON.stringify(copy).includes('left knee'), false);
  assert.equal(JSON.stringify(copy).includes('1990'), false);
  // Every key the app knows is either kept on purpose or left out.
  assert.equal(SHARE_OMITS.length + [...DATA_KEYS].filter((k) => !SHARE_OMITS.includes(k)).length, DATA_KEYS.size);
});

test('pentest JS-02: bad rows are dropped and a bad version is refused', () => {
  const file = structuredClone(SERVER_EXPORT);
  file.exercises = [...file.exercises, { id: 900, name: 123 }, { name: 'No id' }, 'x', { id: 901, name: 'N'.repeat(500) }];
  file.workouts = [...file.workouts, 1, ['x'], { sets: [] }];
  const d = parseDataFile(JSON.stringify(file), content);
  assert.equal(d.exercises.some((e) => typeof e.name !== 'string'), false);
  assert.equal(d.exercises.some((e) => e.name === 'No id'), false);
  assert.equal(d.exercises.find((e) => e.id === 901).name.length, 120);
  assert.equal(d.workouts.length, SERVER_EXPORT.workouts.length);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, schemaVersion: -1 }), content), ImportError);
});
