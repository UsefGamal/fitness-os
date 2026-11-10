import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionIcs, sessionMinutes } from './calendar.js';

const NOW = new Date('2026-11-10T08:00:00Z');

test('sessionIcs makes one floating-time event with a 15 min alarm', () => {
  const ics = sessionIcs({ date: '2026-11-11', time: '07:00', minutes: 75, title: 'Push', description: 'Chest, shoulders', now: NOW });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261111T070000\r\n/);
  assert.match(ics, /DTEND:20261111T081500\r\n/);
  assert.match(ics, /DTSTAMP:20261110T080000Z/);
  assert.match(ics, /SUMMARY:Push\r\n/);
  assert.match(ics, /DESCRIPTION:Chest\\, shoulders/);
  assert.match(ics, /TRIGGER:-PT15M/);
});

test('sessionIcs crosses midnight and escapes text', () => {
  const ics = sessionIcs({ date: '2026-12-31', time: '23:30', minutes: 60, title: 'A; B\nC', now: NOW });
  assert.match(ics, /DTEND:20270101T003000/);
  assert.match(ics, /SUMMARY:A\\; B\\nC/);
});

test('sessionIcs folds long lines and refuses bad input', () => {
  const ics = sessionIcs({ date: '2026-11-11', time: '07:00', title: 'x'.repeat(200), now: NOW });
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75);
  assert.throws(() => sessionIcs({ date: '11/11/2026', time: '07:00', title: 'x' }));
});

test('sessionMinutes estimates from sets and cardio', () => {
  assert.equal(sessionMinutes(null), 60);
  assert.equal(sessionMinutes({ exercises: [{ sets: 4 }, { sets: 3 }, { sets: 3 }], cardio_after: { minutes: 10 } }), 60);
  assert.equal(sessionMinutes({ exercises: [{ sets: 1 }] }), 30);
});
