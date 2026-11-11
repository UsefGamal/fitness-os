import assert from 'node:assert/strict';
import test from 'node:test';

import { activeDays, badgeGroups, daysSince, groupStatus, groupVolume, latestBadge, recordSummary, seriesChange, sessionsLast7, statsTabs } from './statsView.js';

const rows = [
  { key: 'chest', group: 'Chest', done: 6, planned: 6 },
  { key: 'lats', group: 'Back', done: 4, planned: 8 },
  { key: 'middle back', group: 'Back', done: 10.5, planned: 6 },
  { key: 'biceps', group: 'Arms', done: 0, planned: 4 },
];

test('groupVolume adds muscles per group, in body order, and counts muscles in range', () => {
  const g = groupVolume(rows);
  assert.deepEqual(g.map((x) => x.group), ['Chest', 'Back', 'Arms']);
  const back = g.find((x) => x.group === 'Back');
  assert.equal(back.done, 14.5);
  assert.equal(back.planned, 14);
  assert.equal(back.inRange, 1);
  assert.equal(back.muscles.length, 2);
});

test('groupStatus is none without any training', () => {
  assert.equal(groupStatus('untrained', null), 'none');
  assert.equal(groupStatus('untrained', '2026-10-01'), 'untrained');
  assert.equal(groupStatus('ready', '2026-11-08'), 'ready');
});

test('daysSince and the 7-day and 6-month counts', () => {
  assert.equal(daysSince('2026-11-08', '2026-11-10'), 2);
  assert.equal(daysSince(null, '2026-11-10'), null);
  const w = [{ log_date: '2026-11-10' }, { log_date: '2026-11-10' }, { log_date: '2026-11-04' }, { log_date: '2026-11-03' }, { log_date: '2026-03-01' }, { log_date: '2026-12-01' }];
  assert.equal(sessionsLast7(w, '2026-11-10'), 3);
  assert.equal(activeDays(w, '2026-11-10'), 3);
});

test('badgeGroups sorts badges into categories and keeps unknown ones', () => {
  const g = badgeGroups([{ id: 'w10' }, { id: 'pr1' }, { id: 'meals7' }, { id: 'brand_new' }]);
  assert.deepEqual(g.map((x) => x.key), ['consistency', 'strength', 'milestones', 'nutrition']);
  assert.equal(g.find((x) => x.key === 'milestones').badges[0].id, 'brand_new');
});

test('latestBadge, recordSummary and seriesChange', () => {
  assert.equal(latestBadge([{ earned: true, date: '2026-10-01', id: 'a' }, { earned: true, date: '2026-11-01', id: 'b' }, { earned: false, id: 'c' }]).id, 'b');
  assert.equal(latestBadge([]), null);
  assert.deepEqual(recordSummary([{ log_date: '2026-11-01' }, { log_date: '2026-08-01' }], '2026-11-10'), { total: 2, recent: 1 });
  assert.deepEqual(seriesChange([{ value: 65 }, { value: 70 }]), { now: 70, change: 5 });
  assert.equal(seriesChange([]), null);
});

test('Stats tabs start with Overview and hide Body when weight is off (UX-21)', () => {
  assert.deepEqual(statsTabs(true), ['overview', 'muscles', 'strength', 'body', 'badges']);
  assert.deepEqual(statsTabs(false), ['overview', 'muscles', 'strength', 'badges']);
});
