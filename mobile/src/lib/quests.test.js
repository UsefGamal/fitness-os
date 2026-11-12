import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { badgeProgress, doneKeys, longestStreak, questList, questsOn, syncQuests, toggleDaily, totalPoints } from './quests.js';
import { content } from './testContent.js';

const Q = content.quests;
const base = () => emptyData(content);

// Same cases as tests/test_bonus.py.
test('a daily habit toggles on and off and counts its points', () => {
  let d = toggleDaily(base(), '2026-11-04', 'extra_walk', Q);
  assert.ok(doneKeys(d, '2026-11-04', Q).has('extra_walk'));
  assert.equal(totalPoints(d), 10);
  d = toggleDaily(d, '2026-11-04', 'extra_walk', Q);
  assert.equal(totalPoints(d), 0);
});

test('weekly and once quests cannot be ticked by hand', () => {
  const d = base();
  assert.equal(toggleDaily(d, '2026-11-04', 'three_sessions_week', Q), d);
  assert.equal(toggleDaily(d, '2026-11-04', 'first_5kg', Q), d);
});

test('three sessions in a Sunday-start week earns the weekly quest once', () => {
  const d = base();
  d.workouts = ['2026-11-01', '2026-11-02', '2026-11-03'].map((log_date, i) => ({ id: i + 1, log_date, sets: [], is_deload: false }));
  const once = syncQuests(d, '2026-11-04', Q);
  assert.ok(doneKeys(once, '2026-11-04', Q).has('three_sessions_week'));
  assert.equal(syncQuests(once, '2026-11-04', Q), once);
  // The next week starts fresh.
  assert.ok(!doneKeys(once, '2026-11-08', Q).has('three_sessions_week'));
});

test('losing 5 kg from the start weight earns the milestone', () => {
  const d = base();
  d.body_logs = [{ id: 1, log_date: '2026-09-01', weight_kg: 95 }, { id: 2, log_date: '2026-10-20', weight_kg: 89.8 }];
  assert.ok(doneKeys(syncQuests(d, '2026-11-04', Q), '2026-11-04', Q).has('first_5kg'));
});

test('longest streak and badges', () => {
  assert.equal(longestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06']), 3);
  assert.equal(longestStreak([]), 0);
  const b = badgeProgress(175, Q);
  assert.equal(b.current.name, 'Getting Started');
  assert.equal(b.next.threshold, 250);
  assert.equal(b.pct, 50);
  assert.equal(b.level, 4);
});

test('no day-1 awards: the every-day quests wait for the week to end (E7-S3)', () => {
  let d = toggleDaily(base(), '2026-11-08', 'extra_walk', Q); // Sunday, day 1
  const day1 = syncQuests(d, '2026-11-08', Q);
  assert.ok(!doneKeys(day1, '2026-11-08', Q).has('no_missed_week'));
  for (let i = 9; i <= 14; i += 1) d = toggleDaily(d, `2026-11-${String(i).padStart(2, '0')}`, 'extra_walk', Q);
  assert.ok(!doneKeys(syncQuests(d, '2026-11-13', Q), '2026-11-13', Q).has('no_missed_week'), 'not on Friday');
  assert.ok(doneKeys(syncQuests(d, '2026-11-14', Q), '2026-11-14', Q).has('no_missed_week'), 'yes on Saturday, all 7 days');
});

test('the 30-day streak quest is gone; old awards still count', () => {
  assert.ok(!Q.bonus_tasks.some((t) => t.key === 'thirty_day_streak'));
  const d = base();
  d.workouts = Array.from({ length: 31 }, (_, i) => ({ id: i + 1, log_date: `2026-10-${String(i + 1).padStart(2, '0')}`, sets: [], is_deload: false }));
  d.bonus_logs = [{ id: 1, log_date: '2026-10-30', task_key: 'thirty_day_streak', points: 75 }];
  assert.equal(totalPoints(syncQuests(d, '2026-10-31', Q)) >= 75, true);
  assert.ok(!syncQuests(d, '2026-10-31', Q).bonus_logs.some((b) => b.id !== 1 && b.task_key === 'thirty_day_streak'));
});

// REW-1: rewards that fit the person.
const goal = (direction) => [{ id: 'g1', set_on: '2026-09-01', direction, ended_on: null }];
const lost5 = (direction) => ({ ...base(), goals: goal(direction), body_logs: [{ id: 1, log_date: '2026-09-01', weight_kg: 95 }, { id: 2, log_date: '2026-10-20', weight_kg: 89.8 }] });

test('the 5 kg milestone is only for a weight-loss goal', () => {
  for (const direction of ['gain', 'recomp', 'maintain']) {
    const d = lost5(direction);
    assert.equal(syncQuests(d, '2026-11-04', Q), d, direction);
    assert.ok(!questList(d, Q, '2026-11-04').some((t) => t.key === 'first_5kg'), direction);
  }
  const lose = lost5('lose');
  assert.ok(questList(lose, Q, '2026-11-04').some((t) => t.key === 'first_5kg'));
  // Earned before the goal changed: it stays on the list with its points.
  const earned = { ...syncQuests(lose, '2026-11-04', Q), goals: goal('gain') };
  assert.ok(questList(earned, Q, '2026-11-04').some((t) => t.key === 'first_5kg'));
  assert.equal(totalPoints(earned), 50);
  // Never while a cut is off, whatever the goal says.
  const gated = { ...lose, safety: { gates: { no_deficit: true } } };
  assert.ok(!questList(gated, Q, '2026-11-04').some((t) => t.key === 'first_5kg'));
});

test('the water habit names the person\'s own goal', () => {
  const label = (d) => questList(d, Q, '2026-11-04').find((t) => t.key === 'hydration').label;
  assert.equal(label(base()), 'Hit your water goal (3 L)');
  assert.equal(label({ ...base(), settings: { ...base().settings, water_goal_ml: 2500 } }), 'Hit your water goal (2.5 L)');
  // Nothing else on the list changes.
  assert.equal(questList(base(), Q, '2026-11-04').length, Q.bonus_tasks.length);
});

test('quests are on until switched off; off earns nothing and keeps the points', () => {
  const d = toggleDaily(lost5('lose'), '2026-11-04', 'extra_walk', Q);
  assert.equal(questsOn(d), true);
  const off = { ...d, settings: { ...d.settings, modules: { ...d.settings.modules, quests: false } } };
  assert.equal(questsOn(off), false);
  assert.equal(syncQuests(off, '2026-11-04', Q), off);
  assert.equal(totalPoints(off), 10);
  // The switch is not written into new data, so old backups read the same.
  assert.equal('quests' in base().settings.modules, false);
});
