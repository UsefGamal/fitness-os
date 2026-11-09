import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { safeVideo } from './links.js';

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
