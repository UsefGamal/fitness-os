// E3-S4: the target maths locked down two ways.
// 1. A 30-person golden: fixed profiles (lose / maintain / gain, both sexes,
//    small to large bodies) whose targets are stored in
//    fixtures/golden-personas.json. Any change to the maths shows up as a
//    diff there. Regenerate with UPDATE_GOLDEN=1 and say why in the PR.
// 2. A 1,000-profile property test: rules that must hold for anyone.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';

import { emptyData } from './data.js';
import { GAIN_SURPLUS, MIN_KCAL, PROTEIN_G_PER_KG, macroTargets, maxDeficit, saveProfile } from './macros.js';
import { content } from './testContent.js';

const N = content.nutrition;
const TODAY = '2026-11-08';
const GOLDEN = new URL('./fixtures/golden-personas.json', import.meta.url);

/** A tiny seeded PRNG (mulberry32) so the profiles are the same every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const MODES = ['lose', 'maintain', 'gain'];

function persona(r, i) {
  const gender = i % 2 ? 'female' : 'male';
  const mode = MODES[i % 3];
  const height = Math.round(gender === 'male' ? 160 + r() * 35 : 150 + r() * 30);
  const minW = Math.ceil(18.5 * (height / 100) ** 2);
  const weight = Math.round((minW + 2 + r() * 90) * 10) / 10;
  const goal = mode === 'lose' ? Math.max(minW, Math.round(weight - 3 - r() * 40)) : mode === 'gain' ? Math.round(weight + 2 + r() * 10) : Math.round(weight);
  const age = 18 + Math.floor(r() * 50);
  const weeks = 4 + Math.floor(r() * 60);
  const d = new Date(Date.UTC(2026, 10, 8 + weeks * 7));
  return {
    gender, mode, height_cm: height, weight, goal,
    date_of_birth: `${2026 - age}-03-01`,
    activity_level: LEVELS[Math.floor(r() * LEVELS.length)],
    goal_date: d.toISOString().slice(0, 10),
  };
}

function targetsFor(p) {
  let d = emptyData(content);
  d = saveProfile(d, { height_cm: p.height_cm, date_of_birth: p.date_of_birth, gender: p.gender, activity_level: p.activity_level, start_weight_kg: p.weight, goal_weight_low_kg: p.goal - 1, goal_weight_high_kg: p.goal + 1, goal_date: p.goal_date }, TODAY);
  d.goals = d.goals.map((g) => ({ ...g, direction: p.mode }));
  d.diet = { ...(d.diet || {}), plan_start_date: TODAY };
  d.body_logs = [{ id: 1, log_date: TODAY, weight_kg: p.weight }];
  return macroTargets(d, N, TODAY);
}

test('30-person golden', () => {
  const r = rng(12);
  const rows = Array.from({ length: 30 }, (_, i) => {
    const p = persona(r, i);
    const { protein, carbs, fat, fiber, kcal, mode, reasons, tdee } = targetsFor(p);
    return { ...p, out: { kcal, protein, carbs, fat, fiber, mode, reasons, tdee } };
  });
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, `${JSON.stringify(rows, null, 1)}\n`);
  assert.deepEqual(rows, JSON.parse(readFileSync(GOLDEN, 'utf8')));
  // The golden covers every rule, not just the easy middle.
  const reasons = new Set(rows.flatMap((x) => x.out.reasons));
  assert.ok(reasons.has('capped') && reasons.has('floor'), [...reasons].join());
  assert.deepEqual(new Set(rows.map((x) => x.out.mode)), new Set(MODES));
});

test('1,000 random profiles: the targets are always safe and add up', () => {
  const r = rng(2026);
  for (let i = 0; i < 1000; i += 1) {
    const p = persona(r, Math.floor(r() * 1000));
    const t = targetsFor(p);
    const msg = JSON.stringify({ p, t });
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber']) assert.ok(Number.isInteger(t[k]) && t[k] >= 0, msg);
    const floor = MIN_KCAL[p.gender];
    assert.ok(t.kcal >= floor, `floor ${msg}`);
    if (t.mode === 'lose') {
      assert.ok(t.kcal <= Math.round(t.tdee) + 1, `a cut never eats over maintenance ${msg}`);
      assert.ok(t.kcal === floor || t.deficit <= Math.round(maxDeficit(t.tdee, t.weight)) + 1, `deficit cap ${msg}`);
    }
    if (t.mode === 'maintain') assert.ok(Math.abs(t.kcal - t.tdee) <= 1, msg);
    if (t.mode === 'gain') assert.ok(Math.abs(t.kcal - t.tdee - GAIN_SURPLUS) <= 1, msg);
    const goalMid = t.goal_weight;
    assert.ok(Math.abs(t.protein - goalMid * PROTEIN_G_PER_KG[t.mode]) <= 0.5, `protein from goal weight ${msg}`);
    if (t.carbs > 0) assert.ok(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) <= 4, `adds up ${msg}`);
  }
});
