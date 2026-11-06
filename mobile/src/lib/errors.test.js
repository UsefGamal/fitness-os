import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { bugReport, dataCounts, deviceFromUA, errorEntry, pushError, RING_SIZE } from './errors.js';
import { migrate } from './migrate.js';
import { content } from './testContent.js';

const yusuf = migrate(JSON.parse(readFileSync(new URL('./fixtures/v1-yusuf-like.json', import.meta.url), 'utf8')), content);

test('the ring keeps the newest twenty errors', () => {
  let ring = [];
  for (let i = 0; i < 25; i += 1) ring = pushError(ring, errorEntry(new Error(`e${i}`), { now: i }));
  assert.equal(ring.length, RING_SIZE);
  assert.equal(ring[0].message, 'e5');
  assert.equal(ring.at(-1).message, 'e24');
  assert.equal(pushError(null, errorEntry('plain string', { now: 1 })).length, 1);
  assert.equal(errorEntry(undefined).message, 'Unknown error');
  assert.ok(errorEntry(new Error('x'.repeat(1000))).message.length <= 300);
});

test('a bug report has no health or personal data', () => {
  const errors = [errorEntry(new Error('Boom'), { route: '#/workout', now: Date.UTC(2026, 10, 5, 7) })];
  const report = bugReport({ app: { version: '0.4.1', build: '42' }, data: yusuf, errors, device: { platform: 'android', model: 'Redmi Note 12', osVersion: '14', screen: '393x873 @2.75x' }, now: new Date(Date.UTC(2026, 10, 5, 8)) });
  assert.match(report, /App: 0\.4\.1 \(42\), data schema 2/);
  assert.match(report, /Redmi Note 12, Android 14/);
  // P14-02: the report names which APK it came from.
  const friends = bugReport({ app: { version: '0.6.0', build: '60', flavor: 'friends' }, data: yusuf, errors: [] });
  assert.match(friends, /App: 0\.6\.0 \(60\) friends build, data schema/);
  assert.match(report, /workouts: 5/);
  assert.match(report, /Boom/);
  // Nothing from the person's records: weights, notes, health, profile, photos.
  for (const w of yusuf.body_logs) assert.equal(report.includes(String(w.weight_kg)), false, `weight ${w.weight_kg}`);
  for (const bad of ['Seat 5', 'progress-photos', '9000', '62', 'resting', 'sleep', '1999-01-01', 'tabata', 'Padel', 'win']) {
    assert.equal(report.includes(bad), false, bad);
  }
});

test('counts are counts', () => {
  const c = dataCounts(yusuf);
  assert.deepEqual(c, { workouts: 5, sets: 24, weigh_ins: 10, meal_logs: 9, photos: 1, plan_edits: 1, modules_off: 'none', health_connect: 'on' });
  assert.deepEqual(dataCounts(null), {});
  assert.equal(dataCounts({ settings: { modules: { meals: false } }, plan_overrides: { a: [] } }).modules_off, 'meals');
});

test('an empty ring and a web device still make a report', () => {
  const r = bugReport({ app: { version: 'dev', build: 'local' }, data: null, errors: [] });
  assert.match(r, /Device: web/);
  assert.match(r, /none/);
});

test('phone model and Android version come from the user agent', () => {
  assert.deepEqual(deviceFromUA('Mozilla/5.0 (Linux; Android 14; 23021RAA2Y Build/UKQ1.230917.001; wv) AppleWebKit/537.36'), { osVersion: '14', model: '23021RAA2Y' });
  assert.deepEqual(deviceFromUA('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'), { osVersion: '10', model: null });
  assert.deepEqual(deviceFromUA('Mozilla/5.0 (X11; Linux x86_64)'), {});
  assert.deepEqual(deviceFromUA(), {});
  assert.deepEqual(deviceFromUA('Mozilla/5.0 (Linux; Android 13; RMX3511 Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.39 Mobile Safari/537.36'), { osVersion: '13', model: 'RMX3511', webview: '131' });
});

test('the signing code is the first 8 hex digits of the certificate', async () => {
  const { codeOf } = await import('./version.js');
  const sha = 'ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89';
  assert.equal(codeOf(sha), 'ABCD-EF01');
  assert.equal(codeOf(sha.replace(/:/g, '').toUpperCase()), 'ABCD-EF01');
  assert.equal(codeOf('abc'), null);
  assert.equal(codeOf(null), null);
});
