import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { emptyData } from './data.js';
import { startRoutine } from './routines.js';
import { bestFit, daysAWeek, dismissSplitTip, isBestFit, isExperienced, setTrainingDays, splitTip } from './splitFit.js';
import { content } from './testContent.js';

const today = '2026-11-20';
const on = (id, setup) => ({ ...startRoutine(emptyData(content), content, id, '2026-09-01'), ...(setup ? { setup } : {}) });
const sessions = (data, n, from) => ({
  ...data,
  workouts: Array.from({ length: n }, (_, i) => ({ id: i + 1, log_date: addDays(from, i * 7), finished_at: `${addDays(from, i * 7)}T08:00:00Z`, sets: [] })),
});

test('experienced: said so at setup, or 8 weeks and 8 sessions', () => {
  assert.equal(isExperienced({ setup: { experience: 'some' } }, today), true);
  assert.equal(isExperienced({ workouts: [] }, today), false);
  assert.equal(isExperienced(sessions({}, 8, '2026-09-01'), today), true);
  assert.equal(isExperienced(sessions({}, 7, '2026-09-01'), today), false, 'too few sessions');
  assert.equal(isExperienced(sessions({}, 8, '2026-10-20'), '2026-11-20'), false, 'not 8 weeks yet');
});

test('5+ gym days for someone who has trained: the combined Upper / Lower / Push / Pull / Legs week', () => {
  const d = on('upper-lower-4', { days: 5, experience: 'some' });
  assert.equal(daysAWeek(d, content), 5);
  assert.equal(bestFit(d, content, today), 'ul-ppl-5');
  assert.equal(bestFit(d, content, today, 4), 'upper-lower-4');
  assert.equal(bestFit(d, content, today, 3), 'full-body-3');
  const tip = splitTip(d, content, today);
  assert.equal(tip.id, 'ul-ppl-5');
  assert.equal(tip.days, 5);
  assert.ok(/push/i.test(tip.name) && !/\d days/.test(tip.name), tip.name);
});

test('no tip when the plan already fits, or for the same split under another id', () => {
  assert.equal(splitTip(on('ul-ppl-5', { days: 5, experience: 'some' }), content, today), null);
  assert.equal(splitTip(on('ul-ppl', { days: 5, experience: 'some' }), content, today), null);
  assert.ok(isBestFit('ul-ppl', 'ul-ppl-5'));
  assert.equal(splitTip(on('upper-lower-4'), content, today), null, 'days never said: no tip');
});

test('a beginner on 5 days moves up after 8 weeks of training', () => {
  const d = on('starter-3', { days: 5, experience: 'new' });
  assert.equal(splitTip(d, content, today), null, 'still new: the starter plan fits');
  const later = sessions(d, 9, '2026-09-01');
  assert.equal(splitTip(later, content, today)?.id, 'ul-ppl-5');
});

test('changing the days brings the tip; Not now quiets it for those days', () => {
  let d = on('upper-lower-4', { days: 4, experience: 'some' });
  assert.equal(splitTip(d, content, today), null);
  d = setTrainingDays(d, 5);
  const tip = splitTip(d, content, today);
  assert.equal(tip?.id, 'ul-ppl-5');
  d = dismissSplitTip(d, tip);
  assert.equal(splitTip(d, content, today), null);
  assert.equal(splitTip(setTrainingDays(d, 3), content, today)?.id, 'full-body-3', 'other days: a new tip');
  assert.equal(setTrainingDays(d, 9), d, 'only 2-5');
});

test('home stays home', () => {
  const d = on('home-3', { days: 5, experience: 'some' });
  assert.equal(bestFit(d, content, today), 'home-3');
  assert.equal(splitTip(d, content, today), null);
});
