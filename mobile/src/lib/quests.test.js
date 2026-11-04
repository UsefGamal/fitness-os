import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { badgeProgress, doneKeys, longestStreak, syncQuests, toggleDaily, totalPoints } from './quests.js';
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
