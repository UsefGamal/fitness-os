import assert from 'node:assert/strict';
import test from 'node:test';

import { weekHtml, weekText } from './planShare.js';

const day = { label: 'Push', exercises: [{ name: 'Bench <Press>', sets: 4, reps: '8-10', rest: '2m', rir: '2' }] };
const days = [{ date: '2026-11-01', day, evening: null }, { date: '2026-11-02', day: null, evening: { label: 'Tabata' } }];

test('text lists each day with sets, reps, rest and the 8 PM session', () => {
  const t = weekText(days);
  assert.match(t, /Sunday: Push at 07:00\n {2}• Bench <Press>: 4 × 8-10, rest 2m, RIR 2/);
  assert.match(t, /Monday: rest · Tabata at 20:00/);
});

test('the printable page escapes names and includes photos when given', () => {
  const h = weekHtml(days, { photoOf: (n) => (n.startsWith('Bench') ? 'data:image/webp;base64,AAA' : null) });
  assert.match(h, /Bench &lt;Press&gt;/);
  assert.match(h, /<img src="data:image\/webp;base64,AAA"/);
  assert.match(h, /Tabata at 20:00/);
  assert.ok(!h.includes('<Press>'));
});
