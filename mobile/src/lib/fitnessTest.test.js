import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { cleanEntry, cleanResult, cleanTests, clock, deleteTest, MAX_TESTS, nextDue, saveTest, series, summary, testList, timerAt } from './fitnessTest.js';
import { content } from './testContent.js';

const FT = content.training.fitness_test;
const ITEMS = FT.items;
const PUSH = ITEMS.find((i) => i.key === 'pushups');

test('a result is a whole number inside the item\'s range, on one of its moves', () => {
  assert.deepEqual(cleanResult(PUSH, { value: '21.6', move: 'Knee Push-up' }), { value: 22, move: 'Knee Push-up' });
  assert.deepEqual(cleanResult(PUSH, { value: 10, move: 'Bench Press' }), { value: 10, move: 'Push-up' }, 'unknown move: the standard one');
  assert.deepEqual(cleanResult(PUSH, { value: 0 }), { value: 0, move: 'Push-up' }, 'zero is a real result');
  for (const bad of [{ value: -1 }, { value: PUSH.max + 1 }, { value: 'abc' }, { value: '' }, { value: null }, {}, null, 5]) {
    assert.equal(cleanResult(PUSH, bad), null, JSON.stringify(bad));
  }
});

test('a newer build\'s item is kept within plain bounds', () => {
  assert.deepEqual(cleanResult(undefined, { value: 30, move: 'x'.repeat(100) }), { value: 30, move: 'x'.repeat(60) });
  assert.deepEqual(cleanResult(undefined, { value: 30 }), { value: 30 });
  assert.equal(cleanResult(undefined, { value: 1e9 }), null);
});

test('an entry needs a date and at least one result', () => {
  assert.equal(cleanEntry({ date: '2026-11-14', results: {} }, ITEMS), null);
  assert.equal(cleanEntry({ date: '14/11/2026', results: { pushups: { value: 5 } } }, ITEMS), null);
  assert.equal(cleanEntry({ date: '2026-11-14', results: [] }, ITEMS), null);
  assert.equal(cleanEntry('nope', ITEMS), null);
  const e = cleanEntry({ date: '2026-11-14', results: { pushups: { value: 5 }, plank: { value: -3 }, ['__proto__']: { value: 1 } } }, ITEMS);
  assert.deepEqual(e, { date: '2026-11-14', results: { pushups: { value: 5, move: 'Push-up' } } });
});

test('saving keeps one test per day, oldest first', () => {
  let d = { fitness_tests: undefined };
  d = saveTest(d, '2026-11-14', { pushups: { value: 10 } }, ITEMS);
  d = saveTest(d, '2026-10-14', { pushups: { value: 8 } }, ITEMS);
  d = saveTest(d, '2026-11-14', { pushups: { value: 12 }, squats: { value: 30 } }, ITEMS);
  assert.deepEqual(d.fitness_tests.map((t) => t.date), ['2026-10-14', '2026-11-14']);
  assert.equal(d.fitness_tests[1].results.pushups.value, 12);
  assert.equal(d.fitness_tests[1].results.squats.value, 30);
  const same = saveTest(d, '2026-12-01', { pushups: { value: '' } }, ITEMS);
  assert.equal(same, d, 'nothing valid: no change');
  assert.deepEqual(deleteTest(d, '2026-10-14').fitness_tests.map((t) => t.date), ['2026-11-14']);
});

test('the list ignores broken rows and data without the key', () => {
  assert.deepEqual(testList({}), []);
  assert.deepEqual(testList({ fitness_tests: 'x' }), []);
  assert.deepEqual(testList({ fitness_tests: [null, { date: '2026-01-01' }, { date: '2026-01-02', results: {} }] }).map((t) => t.date), ['2026-01-02']);
});

test('import cleaning drops bad rows and keeps at most MAX_TESTS', () => {
  assert.deepEqual(cleanTests('x', ITEMS), []);
  const many = Array.from({ length: MAX_TESTS + 5 }, (_, i) => ({ date: addDays('2026-01-01', i), results: { plank: { value: i } } }));
  const kept = cleanTests([...many, { date: 'bad', results: { plank: { value: 1 } } }], ITEMS);
  assert.equal(kept.length, MAX_TESTS);
  assert.equal(kept[kept.length - 1].results.plank.value, MAX_TESTS + 4, 'the newest are kept');
});

test('the summary compares a result only with the same move', () => {
  let d = {};
  d = saveTest(d, '2026-09-01', { pushups: { value: 10, move: 'Push-up' }, plank: { value: 40 } }, ITEMS);
  d = saveTest(d, '2026-10-01', { pushups: { value: 20, move: 'Knee Push-up' }, plank: { value: 55 } }, ITEMS);
  d = saveTest(d, '2026-11-01', { pushups: { value: 14, move: 'Push-up' } }, ITEMS);
  const [push, squats, plank] = summary(d, ITEMS);
  assert.equal(push.latest.value, 14);
  assert.equal(push.previous.value, 10, 'skips the knee push-ups');
  assert.equal(push.change, 4);
  assert.equal(push.best, 14);
  assert.equal(squats.latest, null);
  assert.equal(plank.latest.date, '2026-10-01', 'the latest test that had a plank');
  assert.equal(plank.change, 15);
  const first = summary(saveTest({}, '2026-11-01', { squats: { value: 30 } }, ITEMS), ITEMS)[1];
  assert.equal(first.previous, null);
  assert.equal(first.change, null);
  assert.deepEqual(series(d, 'pushups', 'Push-up'), [{ date: '2026-09-01', value: 10 }, { date: '2026-11-01', value: 14 }]);
});

test('the next test is due every_days after the last one', () => {
  assert.deepEqual(nextDue({}, '2026-11-14', 28), { status: 'never', days: null, last: null });
  const d = saveTest({}, '2026-11-01', { plank: { value: 30 } }, ITEMS);
  assert.deepEqual(nextDue(d, '2026-11-14', 28), { status: 'later', days: 15, last: '2026-11-01' });
  assert.equal(nextDue(d, '2026-11-29', 28).status, 'due');
  assert.equal(nextDue(d, '2026-12-05', 28).days, -6);
  // Across the clock change (Africa/Cairo has none now, but Europe does).
  assert.equal(nextDue(saveTest({}, '2026-03-20', { plank: { value: 30 } }, ITEMS), '2026-04-17', 28).status, 'due');
});

test('the test timer counts down or up in whole seconds', () => {
  const down = { kind: 'countdown', seconds: 60 };
  assert.deepEqual(timerAt(down, 1000, 1000), { elapsed: 0, left: 60, done: false });
  assert.deepEqual(timerAt(down, 1000, 31999), { elapsed: 30, left: 30, done: false });
  assert.deepEqual(timerAt(down, 1000, 99000), { elapsed: 60, left: 0, done: true });
  assert.deepEqual(timerAt({ kind: 'stopwatch' }, 0, 75400), { elapsed: 75, left: null, done: false });
  assert.equal(timerAt({ kind: 'stopwatch' }, 5000, 1000).elapsed, 0, 'a clock that moved back never goes negative');
  assert.equal(clock(75), '1:15');
  assert.equal(clock(5), '0:05');
  assert.equal(clock(-3), '0:00');
});
