import assert from 'node:assert/strict';
import test from 'node:test';

import { activeKcalAverage, hm, KEEP_DAYS, mergeDaily, readiness, watchTdee, worn } from './activity.js';
import { addDays } from './dates.js';
import * as D from './data.js';
import { macroTargets } from './macros.js';
import { content } from './testContent.js';

const today = '2026-11-05';
const back = (n) => addDays(today, -n);

test('merging keeps sane values, newer reads win, and old days drop off', () => {
  let data = { health_daily: { [back(KEEP_DAYS + 1)]: { steps: 5000 }, [back(1)]: { steps: 1000, sleep_min: 400 } } };
  data = mergeDaily(data, [
    { date: back(1), steps: 8000 },
    { date: back(2), steps: -5, active_kcal: 300, resting_hr: 999, sleep_min: 0 },
    { date: back(3) },
  ], today);
  assert.deepEqual(data.health_daily, { [back(1)]: { steps: 8000, sleep_min: 400 }, [back(2)]: { active_kcal: 300 } });
});

test('a day only counts as worn with enough steps', () => {
  assert.equal(worn({ steps: 6000, active_kcal: 300 }), true);
  assert.equal(worn({ steps: 300, active_kcal: 20 }), false);
  assert.equal(worn({ steps: 6000 }), false);
});

test('the active average needs four worn days and skips the rest', () => {
  const daily = {
    [today]: { steps: 9000, active_kcal: 900 }, // today: not counted
    [back(1)]: { steps: 8000, active_kcal: 400 },
    [back(2)]: { steps: 7000, active_kcal: 300 },
    [back(3)]: { steps: 500, active_kcal: 30 }, // not worn
    [back(4)]: { steps: 9000, active_kcal: 500 },
  };
  assert.equal(activeKcalAverage(daily, today), null);
  daily[back(6)] = { steps: 6000, active_kcal: 200 };
  assert.equal(activeKcalAverage(daily, today), 350);
});

test('watch TDEE adds a share of active calories, within bounds', () => {
  assert.equal(watchTdee(1800, 400), 1800 * 1.2 + 300);
  assert.equal(watchTdee(1800, 0), 1800 * 1.2);
  assert.equal(watchTdee(1800, 99999), 1800 * 1.9);
});

test('targets follow the watch only when switched on', () => {
  let data = D.logBody(D.emptyData(content), { log_date: back(10), weight_kg: 90 });
  data.profile = { date_of_birth: '1995-01-01', height_cm: 173, gender: 'male', activity_level: 'moderate' };
  const daily = {};
  for (let i = 1; i <= 7; i += 1) daily[back(i)] = { steps: 10000, active_kcal: 800 };
  data = { ...data, health_daily: daily };
  const off = macroTargets(data, content.nutrition, today);
  assert.equal(off.source, 'profile');
  const on = macroTargets({ ...data, settings: { ...data.settings, health: { adaptive: true } } }, content.nutrition, today);
  assert.equal(on.source, 'watch');
  assert.equal(on.active_avg, 800);
  assert.equal(on.tdee, Math.round(on.bmr * 1.2 + 600));
});

test('readiness compares last night with your own two weeks', () => {
  const daily = {};
  for (let i = 1; i <= 7; i += 1) daily[back(i)] = { sleep_min: 450, resting_hr: 58 };
  assert.equal(readiness(daily, today).level, 'unknown'); // no watch last night
  daily[today] = { sleep_min: 440, resting_hr: 59 };
  assert.equal(readiness(daily, today).level, 'good');
  daily[today] = { sleep_min: 330, resting_hr: 59 };
  assert.deepEqual(readiness(daily, today).reasons, ['short sleep']);
  daily[today] = { sleep_min: 330, resting_hr: 64 };
  assert.equal(readiness(daily, today).level, 'easy');
  // Without two weeks of history, only the 6-hour rule applies.
  assert.equal(readiness({ [today]: { sleep_min: 420, resting_hr: 90 } }, today).level, 'good');
});

test('hours and minutes', () => {
  assert.equal(hm(440), '7h 20m');
  assert.equal(hm(45), '45m');
});
