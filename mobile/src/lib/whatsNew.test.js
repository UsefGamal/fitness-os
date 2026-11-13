import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { compareVersions, markSeen, notesUpTo, parseVersion, unseenNotes } from './whatsNew.js';
import { WHATS_NEW } from './whatsNewNotes.js';

const notes = [
  { version: '0.9.4', items: [{ icon: 'star', text: 'a' }] },
  { version: '0.10.0', items: [{ icon: 'star', text: 'c' }] },
  { version: '0.9.5', items: [{ icon: 'star', text: 'b' }] },
];
const used = { workouts: [{ id: 1 }], settings: {} };
const versions = (list) => list.map((n) => n.version);

test('versions parse and compare by number, not by text', () => {
  assert.deepEqual(parseVersion('v0.9.5'), [0, 9, 5]);
  assert.equal(parseVersion('dev'), null);
  assert.equal(parseVersion('0.4'), null);
  assert.ok(compareVersions('0.10.0', '0.9.5') > 0);
  assert.equal(compareVersions('0.9.5', '0.9.5'), 0);
  assert.equal(compareVersions('dev', '0.9.5'), null);
});

test('notesUpTo: everything this build has, newest first, nothing from the future', () => {
  assert.deepEqual(versions(notesUpTo('0.9.5', notes)), ['0.9.5', '0.9.4']);
  assert.deepEqual(versions(notesUpTo('0.10.2', notes)), ['0.10.0', '0.9.5', '0.9.4']);
  assert.deepEqual(notesUpTo('dev', notes), []);
  assert.deepEqual(notesUpTo('0.9.3', notes), []);
});

test('an update shows every version since the one last seen', () => {
  const d = { ...used, settings: { whats_new_seen: '0.9.4' } };
  assert.deepEqual(versions(unseenNotes(d, '0.10.0', notes)), ['0.10.0', '0.9.5']);
  assert.deepEqual(unseenNotes({ ...used, settings: { whats_new_seen: '0.10.0' } }, '0.10.0', notes), []);
  // A build with no note of its own shows nothing new.
  assert.deepEqual(unseenNotes({ ...used, settings: { whats_new_seen: '0.10.0' } }, '0.10.1', notes), []);
});

test('a phone that never saw a note gets only the latest; a new install gets none', () => {
  assert.deepEqual(versions(unseenNotes(used, '0.10.0', notes)), ['0.10.0']);
  assert.deepEqual(unseenNotes({ workouts: [], meal_logs: [], body_logs: [], settings: {} }, '0.10.0', notes), []);
  assert.deepEqual(unseenNotes(used, 'dev', notes), []);
  assert.deepEqual(versions(unseenNotes({ meal_logs: [{}] }, '0.9.5', notes)), ['0.9.5']);
});

test('markSeen keeps the other settings and does nothing on a dev build', () => {
  const d = { settings: { notifications: true } };
  assert.deepEqual(markSeen(d, '0.9.5').settings, { notifications: true, whats_new_seen: '0.9.5' });
  assert.equal(markSeen(d, 'dev'), d);
  const seen = markSeen(d, '0.9.5');
  assert.equal(markSeen(seen, '0.9.5'), seen);
  assert.deepEqual(unseenNotes({ ...used, ...seen }, '0.9.5', notes), []);
});

test('the real notes: valid versions, newest first, short, with icons that exist', () => {
  const iconSrc = readFileSync(new URL('../components/Icon.jsx', import.meta.url), 'utf8');
  const hasIcon = (name) => new RegExp(`^  ${name}: '`, 'm').test(iconSrc);
  assert.ok(WHATS_NEW.length > 0);
  for (let i = 0; i < WHATS_NEW.length; i += 1) {
    const n = WHATS_NEW[i];
    assert.ok(parseVersion(n.version), n.version);
    if (i) assert.ok(compareVersions(WHATS_NEW[i - 1].version, n.version) > 0, 'newest first, no repeats');
    assert.ok(n.items.length >= 1 && n.items.length <= 6, `${n.version}: 1 to 6 lines`);
    for (const it of n.items) {
      assert.ok(hasIcon(it.icon), `${n.version}: unknown icon ${it.icon}`);
      assert.ok(it.text.length <= 130, `${n.version}: line too long`);
    }
  }
});

test('the newest notes are not older than the version in package.json (UPD-1)', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const gradle = readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');
  assert.ok(parseVersion(pkg.version), pkg.version);
  const newest = WHATS_NEW.map((n) => n.version).sort(compareVersions).at(-1);
  assert.ok(compareVersions(newest, pkg.version) >= 0, `notes ${newest} vs package.json ${pkg.version}`);
  // The APK's fallback name reads the same file; no second number to forget.
  assert.match(gradle, /JsonSlurper\(\)\.parse\(file\("\.\.\/\.\.\/package\.json"\)\)\.version/);
  assert.doesNotMatch(gradle, /versionName[^\n]*"\d+\.\d+\.\d+"/);
});
