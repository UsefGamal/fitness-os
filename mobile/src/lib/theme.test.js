import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { reduceMotion, resolveTheme, setReduceMotion, setTextSize, setTheme, TEXT_SIZES, textScale, textSize, THEME_BG, themeChoice } from './theme.js';

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
  // Sizes, safe areas and the text size are the same in both themes.
  const layout = new Set(['--radius', '--radius-lg', '--gutter', '--tabbar', '--ts']);
  for (const n of dark) if (!layout.has(n)) assert.ok(light.has(n), `${n} has no light value`);
  assert.equal(THEME_BG.light, '#f2f2f7');
  assert.ok(block(':root[data-theme="light"] {').includes(`--bg: ${THEME_BG.light}`));
});

test('text size: 100% by default, 115 or 130 when picked, anything else ignored', () => {
  assert.deepEqual(TEXT_SIZES, [100, 115, 130]);
  assert.equal(textSize({}), 100);
  assert.equal(textSize({ settings: { text_size: 130 } }), 130);
  assert.equal(textSize({ settings: { text_size: 200 } }), 100);
  const d = setTextSize({ settings: { theme: 'light' } }, 115);
  assert.deepEqual(d.settings, { theme: 'light', text_size: 115 });
  assert.equal(setTextSize(d, 999), d);
  assert.equal(textScale(130), 1.3);
  assert.equal(textScale(undefined), 1);
});

test('text size: every font size up to 34 px follows --ts', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const fixed = [...css.matchAll(/font-size: *([0-9.]+)px/g)].map((m) => Number(m[1])).filter((n) => n <= 34);
  assert.deepEqual(fixed, []);
  assert.match(css, /--ts: 1;/);
});

test('reduce motion (MOVE-2): off by default, on only when set to true', () => {
  assert.equal(reduceMotion({ settings: {} }), false);
  assert.equal(reduceMotion(undefined), false);
  assert.equal(reduceMotion({ settings: { reduce_motion: 'yes' } }), false);
  const on = setReduceMotion({ settings: { theme: 'light' } }, true);
  assert.equal(reduceMotion(on), true);
  assert.equal(on.settings.theme, 'light');
  assert.equal(reduceMotion(setReduceMotion(on, false)), false);
});

test('every reduced-motion block in styles.css has its Settings > Look mirror', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const blocks = css.split('@media (prefers-reduced-motion: reduce)').length - 1;
  const mirrors = css.split('/* reduce-motion mirror').length - 1;
  assert.ok(blocks > 0);
  assert.equal(mirrors, blocks);
});
