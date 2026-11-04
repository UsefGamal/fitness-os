import assert from 'node:assert/strict';
import test from 'node:test';

import { applyImport, bodyCsv, csvDate, mealsCsv, guessGroup, parseCsv, previewImport, readWorkoutCsv, toCsv } from './csv.js';

const base = () => ({
  exercises: [{ id: 1, name: 'Bench Press', muscle_group: 'Chest' }],
  workouts: [{ id: 1, log_date: '2026-11-01', workout_type: 'gym', notes: 'Push, "heavy"', sets: [{ id: 1, exercise_id: 1, set_number: 1, weight_kg: 60, reps: 8, rpe: null }] }],
});

test('export writes one quoted row per set, and reads back', () => {
  const csv = toCsv(base());
  assert.match(csv, /^date,workout,exercise,muscle_group,set,weight_kg,reps,rpe\n/);
  assert.match(csv, /2026-11-01,"Push, ""heavy""",Bench Press,Chest,1,60,8,/);
  const back = readWorkoutCsv(csv);
  assert.equal(back.source, 'Fitness OS');
  assert.deepEqual(back.workouts[0].sets[0], { exercise: 'Bench Press', weightKg: 60, reps: 8, rpe: null });
});

test('parser handles quotes, CRLF and semicolons', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x,1","y""z"\r\n'), [['a', 'b'], ['x,1', 'y"z']]);
  assert.deepEqual(parseCsv('a;b\n1,5;2\n'), [['a', 'b'], ['1,5', '2']]);
});

test('dates from Strong and Hevy', () => {
  assert.equal(csvDate('2024-03-05 07:10:00'), '2024-03-05');
  assert.equal(csvDate('5 Mar 2024, 07:10'), '2024-03-05');
  assert.equal(csvDate('soon'), null);
});

test('Strong: warm-ups and rest rows skipped, pounds converted when asked', () => {
  const strong = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2024-03-05 07:10:00,Push,1h,Bench Press (Barbell),W,45,10,0,0,,,',
    '2024-03-05 07:10:00,Push,1h,Bench Press (Barbell),1,135,8,0,0,,,8',
    '2024-03-05 07:10:00,Push,1h,Bench Press (Barbell),Rest Timer,0,0,0,90,,,',
  ].join('\n');
  const kg = readWorkoutCsv(strong);
  assert.equal(kg.source, 'Strong');
  assert.equal(kg.skipped, 2);
  assert.equal(kg.workouts[0].sets[0].weightKg, 135);
  assert.equal(readWorkoutCsv(strong, { unit: 'lb' }).workouts[0].sets[0].weightKg, 61.23);
});

test('Hevy: kg column, warm-up set type skipped', () => {
  const hevy = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    'Legs,"5 Mar 2024, 07:10","5 Mar 2024, 08:00",,Squat (Barbell),,,0,warmup,40,10,,,',
    'Legs,"5 Mar 2024, 07:10","5 Mar 2024, 08:00",,Squat (Barbell),,,1,normal,100,5,,,8.5',
  ].join('\n');
  const r = readWorkoutCsv(hevy);
  assert.equal(r.source, 'Hevy');
  assert.deepEqual(r.workouts[0], { date: '2024-03-05', label: 'Legs', sets: [{ exercise: 'Squat (Barbell)', weightKg: 100, reps: 5, rpe: 8.5 }] });
});

test('unknown files are refused', () => {
  assert.throws(() => readWorkoutCsv('foo,bar\n1,2'), /Unknown CSV/);
});

test('preview skips duplicates; import adds workouts and new exercises only', () => {
  const data = base();
  const parsed = { workouts: [
    { date: '2026-11-01', label: 'push, "heavy"', sets: [{ exercise: 'Bench Press', weightKg: 60, reps: 8, rpe: null }] },
    { date: '2026-11-03', label: 'Legs', sets: [{ exercise: 'Squat (Barbell)', weightKg: 100, reps: 5, rpe: null }, { exercise: 'Squat (Barbell)', weightKg: 100, reps: 5, rpe: null }] },
  ] };
  const p = previewImport(data, parsed);
  assert.equal(p.duplicates, 1);
  assert.deepEqual(p.newExercises, ['Squat (Barbell)']);
  const out = applyImport(data, p);
  assert.equal(out.workouts.length, 2);
  assert.deepEqual(out.workouts[0], data.workouts[0]);
  const added = out.workouts[1];
  assert.equal(added.imported, true);
  assert.deepEqual(added.sets.map((s) => [s.id, s.set_number]), [[2, 1], [3, 2]]);
  assert.equal(out.exercises.find((e) => e.name === 'Squat (Barbell)').muscle_group, 'Legs');
  assert.equal(guessGroup('Lat Pulldown'), 'Back');
});

test('body and meal CSVs', () => {
  assert.equal(bodyCsv({ body_logs: [{ log_date: '2026-11-01', weight_kg: 82, waist_cm: 90 }] }), 'date,weight_kg,waist_cm,chest_cm,arm_cm,hips_cm,thigh_cm,sleep_hours\n2026-11-01,82,90,,,,,\n');
  assert.match(mealsCsv({ meal_logs: [{ log_date: '2026-11-01', meal_slot: 'lunch', completed: true, option_key: 'option_a' }] }), /2026-11-01,lunch,yes,option_a,\n$/);
});
