import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveTheme, setTheme, THEME_BG, themeChoice } from './theme.js';

test('theme: dark by default, light or matching the phone when chosen', () => {
  assert.equal(themeChoice({}), 'dark');
  assert.equal(themeChoice({ settings: { theme: 'pink' } }), 'dark');
  assert.equal(themeChoice(setTheme({ settings: {} }, 'light')), 'light');
  assert.deepEqual(setTheme({ settings: {} }, 'pink'), { settings: {} });
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('system', true), 'light');
  assert.equal(resolveTheme('system', false), 'dark');
});

test('theme: every dark colour token has a light value', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const block = (sel) => css.slice(css.indexOf(sel)).split('}')[0];
  const names = (b) => new Set([...b.matchAll(/(--[a-z0-9-]+):\s*(?![^;]*env\()/g)].map((m) => m[1]));
  const dark = names(block(':root {'));
  const light = names(block(':root[data-theme="light"] {'));
  // Sizes and safe areas are the same in both themes.
  const layout = new Set(['--radius', '--radius-lg', '--gutter', '--tabbar']);
  for (const n of dark) if (!layout.has(n)) assert.ok(light.has(n), `${n} has no light value`);
  assert.equal(THEME_BG.light, '#f2f2f7');
  assert.ok(block(':root[data-theme="light"] {').includes(`--bg: ${THEME_BG.light}`));
});
