import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { RELEASES_URL, safeOutside, safeVideo, SHARE_APP_TEXT } from './links.js';

test('safeVideo keeps https links to the video sites', () => {
  assert.equal(safeVideo('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
  assert.equal(safeVideo('https://youtu.be/abc'), 'https://youtu.be/abc');
  assert.equal(safeVideo('https://www.instagram.com/reel/x/'), 'https://www.instagram.com/reel/x/');
});

test('safeVideo drops anything a crafted backup could use', () => {
  for (const bad of [
    'javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,<form>password', 'http://www.youtube.com/x',
    'https://evil.example/phish', 'https://youtube.com.evil.example/x', 'https://user:pw@www.youtube.com/x',
    'https://www.youtube.com:8443/x', 'intent://x#Intent;end', 'market://details?id=x', 'tel:123', '/workout', '',
    null, 42, {}, `https://youtu.be/${'a'.repeat(600)}`,
  ]) assert.equal(safeVideo(bad), null, String(bad));
});

test('every video link in the plan content passes', () => {
  const content = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
  const urls = [];
  JSON.stringify(content, (k, v) => {
    if (k === 'video' && v) urls.push(v);
    return v;
  });
  assert.ok(urls.length > 0);
  for (const u of urls) assert.notEqual(safeVideo(u), null, u);
});

test('the update page and the share text are exactly the fixed strings (UPD-1)', () => {
  assert.equal(RELEASES_URL, 'https://github.com/UsefGamal/fitness-os/releases/latest');
  assert.equal(SHARE_APP_TEXT, 'Fitness OS: a free training and meal plan app that keeps your data on your phone. Download: https://github.com/UsefGamal/fitness-os/releases/latest');
  assert.equal(safeOutside(RELEASES_URL), RELEASES_URL);
  for (const bad of [`${RELEASES_URL}/`, 'https://github.com/UsefGamal/fitness-os', 'https://github.com.evil.example/UsefGamal/fitness-os/releases/latest', 'http://github.com/UsefGamal/fitness-os/releases/latest', 'javascript:alert(1)', '', null, 42]) {
    assert.equal(safeOutside(bad), null, String(bad));
  }
});

test('no new network code: only the two fetches of files inside the app (UPD-1)', () => {
  const root = new URL('../', import.meta.url);
  const hits = [];
  for (const name of readdirSync(root, { recursive: true })) {
    const file = String(name);
    if (!/\.(js|jsx)$/.test(file) || /\.test\.js$/.test(file)) continue;
    if (/\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource\(/.test(readFileSync(new URL(file, root), 'utf8'))) hits.push(file.replaceAll('\\', '/'));
  }
  assert.deepEqual(hits.sort(), ['store/catalogue.js', 'store/share.js']);
});
