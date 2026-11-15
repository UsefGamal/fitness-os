import { test } from 'node:test';
import assert from 'node:assert/strict';

import { announce, mealTickLine, onAnnounce, setLoggedLine } from './announce.js';

test('announce reaches every listener once, trimmed; empty text says nothing', () => {
  const heard = [];
  const off = onAnnounce((s) => heard.push(s));
  announce('  Rest over.  ');
  announce('');
  announce(null);
  off();
  announce('after unsubscribe');
  assert.deepEqual(heard, ['Rest over.']);
});

test('a lifted set: weight and reps in words, no symbols', () => {
  const line = setLoggedLine({ setNo: 2, set: { reps: 8, weight_kg: 60 }, name: 'Bench press' });
  assert.equal(line, 'Set 2 of Bench press logged: 60 kilograms, 8 reps.');
  assert.ok(!line.includes('×'));
  assert.equal(setLoggedLine({ setNo: 1, set: { reps: 12, weight_kg: 0 }, name: 'Push-up' }), 'Set 1 of Push-up logged: 12 reps.');
});

test('a hold says seconds, with any added weight', () => {
  assert.equal(setLoggedLine({ setNo: 1, set: { reps: 40, track: 'time', duration_s: 40 }, name: 'Plank' }), 'Set 1 of Plank logged: 40 seconds.');
  assert.equal(setLoggedLine({ setNo: 3, set: { reps: 30, weight_kg: 10, track: 'time' }, name: 'Plank' }), 'Set 3 of Plank logged: 30 seconds with 10 kilograms.');
});

test('a record or a first baseline rides on the same line', () => {
  const set = { reps: 5, weight_kg: 100 };
  assert.match(setLoggedLine({ setNo: 1, set, name: 'Squat', kind: 'best' }), /logged: 100 kilograms, 5 reps\. New record!$/);
  assert.match(setLoggedLine({ setNo: 1, set, name: 'Squat', kind: 'baseline' }), /First time logged/);
});

test('meal ticks: the count, the last one, and an untick', () => {
  assert.equal(mealTickLine({ meal: 'Lunch', eaten: true, done: 2, total: 5 }), 'Lunch ticked. 2 of 5 meals eaten.');
  assert.equal(mealTickLine({ meal: 'Dinner', eaten: true, done: 5, total: 5 }), 'Dinner ticked. Every meal eaten today.');
  assert.equal(mealTickLine({ meal: 'Lunch', eaten: false, done: 1, total: 5 }), 'Lunch not eaten.');
});
