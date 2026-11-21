// BRAND-1: every text colour in both themes keeps WCAG AA contrast on the
// surfaces it sits on, so a later palette change can't quietly break it.
// Reads the two token blocks at the top of styles.css.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function block(selector) {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `${selector} block missing`);
  const body = css.slice(i, css.indexOf('}', i));
  const out = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const DARK = block(':root');
const LIGHT = { ...DARK, ...block(':root[data-theme="light"]') };

function hex(tokens, name, seen = new Set()) {
  const v = tokens[name];
  assert.ok(v, `--${name} is not defined`);
  const ref = /^var\(--([\w-]+)\)$/.exec(v);
  if (ref) {
    assert.ok(!seen.has(name), `--${name} refers to itself`);
    return hex(tokens, ref[1], new Set([...seen, name]));
  }
  if (v === '#000') return '#000000';
  if (v === '#fff') return '#ffffff';
  assert.match(v, /^#[0-9a-f]{6}$/i, `--${name} should be a 6-digit hex, got ${v}`);
  return v;
}

function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Text colours, the surfaces they sit on, and the 4.5:1 they need.
const TEXT = ['text', 'text-body', 'muted', 'accent', 'danger', 'warn', 'guava', 'nile', 'orange', 'purple'];
const SURFACES = ['bg', 'surface', 'surface2'];

for (const [theme, tokens] of [['dark', DARK], ['light', LIGHT]]) {
  test(`${theme}: text colours pass 4.5:1 on every surface`, () => {
    for (const fg of TEXT) {
      for (const bg of SURFACES) {
        const r = ratio(hex(tokens, fg), hex(tokens, bg));
        assert.ok(r >= 4.5, `${theme} --${fg} on --${bg} is ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${theme}: button text on the green fill passes 4.5:1`, () => {
    const r = ratio(hex(tokens, 'on-accent'), hex(tokens, 'accent-fill'));
    assert.ok(r >= 4.5, `${theme} --on-accent on --accent-fill is ${r.toFixed(2)}:1`);
  });

  test(`${theme}: bars and rings pass 3:1 on cards`, () => {
    for (const fg of ['accent-stroke', 'nile', 'guava']) {
      const r = ratio(hex(tokens, fg), hex(tokens, 'surface'));
      assert.ok(r >= 3, `${theme} --${fg} on --surface is ${r.toFixed(2)}:1`);
    }
  });

  test(`${theme}: badge text on its own colour passes 4.5:1`, () => {
    for (const tone of ['accent', 'orange']) {
      const r = ratio(hex(tokens, 'on-tone'), hex(tokens, tone));
      assert.ok(r >= 4.5, `${theme} --on-tone on --${tone} is ${r.toFixed(2)}:1`);
    }
  });
}

test('the brand green is the same fill in both themes', () => {
  assert.equal(hex(DARK, 'accent-fill'), '#30d158');
  assert.equal(hex(LIGHT, 'accent-fill'), '#30d158');
});
