import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { mealDayFor } from './meals.js';
import {
  CLAMP, DAY_TOLERANCE, OPTION_TOLERANCE, dayKcal, isProteinFood, optionChoices, planDayFor, planFit, planKcal,
  pluralName, portionText, portionsOf, scaleDay, scaleFactor, scaleOption, stepOf,
} from './portions.js';
import { shoppingList } from './shopping.js';
import { widgetDays } from './widget.js';
import { content } from './testContent.js';

const N = content.nutrition;
const TODAY = '2026-11-13';
const allOptions = () => N.days.flatMap((d) => d.meals.flatMap((m) => m.options));
const factors = () => {
  const out = [];
  for (let f = 0.7; f <= 1.4 + 1e-9; f += 0.05) if (Math.abs(f - 1) > 0.05 + 1e-9) out.push(Number(f.toFixed(2)));
  return out;
};

/** A person whose target comes out at about `kcal` (a profile, a weight). */
function personAt(kcal) {
  // Maintain at moderate activity; the height moves the BMR, so search it.
  let best = null;
  for (const [gender, activity_level] of [['female', 'sedentary'], ['female', 'light'], ['male', 'moderate']]) for (let h = 150; h <= 200; h += 2) {
    for (const w of [45, 55, 65, 75, 85, 95, 110]) {
      const d = {
        ...emptyData(content),
        profile: { height_cm: h, date_of_birth: '1995-01-01', gender, activity_level },
        body_logs: [{ log_date: TODAY, weight_kg: w }],
      };
      const fit = planFit(d, N, TODAY);
      const got = fit.raw * fit.plan;
      if (!best || Math.abs(got - kcal) < Math.abs(best.got - kcal)) best = { d, got };
    }
  }
  return best;
}

test('the plan day is the average of option A over normal days, about 1,920 kcal', () => {
  const plan = planKcal(N);
  const normal = N.days.filter((d) => !d.is_refeed);
  assert.equal(plan, Math.round(normal.reduce((n, d) => n + dayKcal(d), 0) / normal.length));
  assert.ok(plan > 1850 && plan < 2000, `plan ${plan}`);
});

test('factor: dead band, scaled band and too far', () => {
  assert.deepEqual(scaleFactor(1939, 1920), { factor: 1, raw: 1939 / 1920, state: 'same' });
  assert.equal(scaleFactor(1920 * 0.95, 1920).state, 'same');
  assert.equal(scaleFactor(1920 * 1.05, 1920).state, 'same');
  assert.equal(scaleFactor(1500, 1920).state, 'scaled');
  assert.equal(scaleFactor(1500, 1920).factor, 1500 / 1920);
  assert.equal(scaleFactor(1920 * CLAMP[0], 1920).state, 'scaled');
  assert.equal(scaleFactor(1920 * CLAMP[1], 1920).state, 'scaled');
  assert.equal(scaleFactor(1200, 1920).state, 'far');
  assert.equal(scaleFactor(3000, 1920).state, 'far');
  assert.equal(scaleFactor(1200, 1920).factor, 1);
  assert.equal(scaleFactor(0, 1920).state, 'same');
  assert.equal(scaleFactor(NaN, 1920).state, 'same');
});

test('protein foods, steps and the counted portions', () => {
  assert.equal(isProteinFood(N.foods.grilled_chicken_breast_200g), true);
  assert.equal(isProteinFood(N.foods.white_rice_150g), false);
  assert.equal(isProteinFood(N.foods.boiled_egg, 'boiled_egg'), true);
  assert.equal(isProteinFood(null), false);
  assert.equal(stepOf('boiled_egg'), 1);
  assert.equal(stepOf('whole_wheat_pita'), 0.5);
  assert.equal(stepOf('whole_wheat_pita_half'), 1);
  assert.equal(stepOf('white_rice_150g'), 0.5);
  assert.equal(stepOf('labneh_2tbsp'), 0.5);
  assert.equal(stepOf('dates_3pc'), 1 / 3);
  assert.equal(stepOf('whole_wheat_toast_2slices'), 0.5);
  assert.deepEqual(portionsOf({ items: ['a', 'b', 'a'] }), [['a', 2], ['b', 1]]);
  assert.deepEqual(portionsOf({ portions: [{ key: 'a', units: 1.5 }] }), [['a', 1.5]]);
  assert.deepEqual(portionsOf(null), []);
});

test('portion text: halves, plurals, grams, slices', () => {
  const names = N.food_names;
  assert.equal(portionText('whole_wheat_pita_half', 3, names), '1.5 wholewheat pitas');
  assert.equal(portionText('whole_wheat_pita_half', 1, names), 'half a wholewheat pita');
  assert.equal(portionText('boiled_egg', 3, names), '3 boiled eggs');
  assert.equal(portionText('boiled_egg', 1, names), 'a boiled egg');
  assert.equal(portionText('avocado_half', 1, names), 'half an avocado');
  assert.equal(portionText('avocado_half', 2, names), 'an avocado');
  assert.equal(portionText('lentil_soup_bowl', 0.5, names), 'half a bowl of lentil soup');
  assert.equal(portionText('ful_medames_bowl', 1.5, names), '1.5 bowls of ful medames');
  assert.equal(portionText('white_rice_150g', 1.5, names), 'white rice 225 g');
  assert.equal(portionText('labneh_2tbsp', 0.5, names), 'labneh 1 tbsp');
  assert.equal(portionText('whole_wheat_toast_2slices', 0.5, names), 'a slice of wholewheat toast');
  assert.equal(portionText('whole_wheat_toast_2slices', 1.5, names), '3 slices of wholewheat toast');
  assert.equal(portionText('dates_3pc', 4 / 3, names), '4 dates');
  assert.equal(portionText('unknown_thing', 2, {}), '2 unknown things');
  assert.equal(pluralName('za\'atar manakish'), 'za\'atar manakish');
  assert.equal(pluralName('piece of fruit'), 'pieces of fruit');
  assert.equal(pluralName('box'), 'boxes');
});

test('factor 1 changes nothing', () => {
  const o = N.days[0].meals[0].options[0];
  assert.deepEqual(scaleOption(o, 1, N.foods), { ...o, changed: false, fits: true });
  const d = scaleDay(N.days[0], 1, N);
  assert.equal(d.day, N.days[0]);
  assert.equal(d.fits, true);
});

for (const kcal of [1500, 2400]) {
  test(`three sample days fitted to ${kcal} kcal: day within 5%, protein foods kept, nothing removed, halves`, () => {
    const factor = kcal / planKcal(N);
    for (const idx of [0, 4, 9]) {
      const day = N.days[idx];
      const { day: s, fits } = scaleDay(day, factor, N);
      assert.equal(fits, true, `day ${day.day_index}`);
      const want = dayKcal(day) * factor;
      assert.ok(Math.abs(dayKcal(s) - want) / want <= DAY_TOLERANCE);
      s.meals.forEach((meal, mi) => meal.options.forEach((o, oi) => {
        const orig = day.meals[mi].options[oi];
        const before = new Map(portionsOf(orig));
        const after = new Map(portionsOf(o));
        assert.deepEqual([...after.keys()], [...before.keys()], 'same foods');
        for (const [key, units] of after) {
          assert.ok(units > 0, `${key} kept`);
          const step = stepOf(key);
          assert.ok(Math.abs(units / step - Math.round(units / step)) < 1e-4, `${key} ${units} in steps of ${step}`);
          if (isProteinFood(N.foods[key], key)) assert.ok(units >= before.get(key), `${key} protein food not cut`);
        }
        if (factor > 1) assert.ok(o.protein >= orig.protein, 'protein not lower going up');
        if (o.changed) assert.equal(o.ingredients.length, after.size);
        else assert.equal(o.ingredients, orig.ingredients);
      }));
    }
  });
}

test('at 1,500 kcal the day eats less carbs and fat but keeps the protein foods', () => {
  const { day: s } = scaleDay(N.days[0], 1500 / planKcal(N), N);
  const sum = (d, k) => d.meals.reduce((n, m) => n + m.options[0][k], 0);
  assert.ok(sum(s, 'carbs') < sum(N.days[0], 'carbs'));
  assert.ok(sum(s, 'fat') < sum(N.days[0], 'fat'));
  // Only what was in the bread, rice and nuts goes: under a fifth.
  assert.ok(sum(s, 'protein') >= sum(N.days[0], 'protein') * 0.8);
});

test('property: every option, factors 0.7 to 1.4: protein never lower going up, never further off than as written', () => {
  let missed = 0;
  for (const f of factors()) {
    for (const o of allOptions()) {
      const s = scaleOption(o, f, N.foods);
      const err = Math.abs(s.kcal - o.kcal * f) / (o.kcal * f);
      if (f > 1) assert.ok(s.protein >= o.protein - 1e-6, `protein ${o.items} at ${f}`);
      if (err <= OPTION_TOLERANCE) continue;
      // Missed: protein foods hold, or a small snack's half step is
      // coarser than the change; never further off than leaving it alone.
      missed += 1;
      assert.ok(err <= Math.abs(o.kcal - o.kcal * f) / (o.kcal * f) + 1e-9, `${o.items} at ${f}: worse than as written`);
    }
  }
  // Mostly small snacks and protein-only options; the day still fits (below).
  assert.ok(missed < allOptions().length * factors().length * 0.35, `${missed} missed`);
});

test('days fit for factors 0.8 to 1.4 on nearly all days; outside that some fall back', () => {
  let missed = 0;
  let total = 0;
  for (const f of factors().filter((x) => x >= 0.8)) {
    for (const d of N.days) {
      total += 1;
      if (!scaleDay(d, f, N).fits) missed += 1;
    }
  }
  // A protein-heavy day can't drop 20% without cutting protein: it shows as written.
  assert.ok(missed <= 2, `${missed} of ${total} days missed`);
});

test('option choices: best first, different kcal each', () => {
  const o = N.days[0].meals[2].options[0];
  const list = optionChoices(o, 0.8, N.foods);
  assert.ok(list.length > 1 && list.length <= 6);
  assert.equal(new Set(list.map((x) => x.kcal)).size, list.length);
  for (let i = 1; i < list.length; i += 1) assert.ok(list[i].score >= list[i - 1].score);
  assert.equal(optionChoices({ items: [] }, 0.8, N.foods)[0].changed, false);
});

test('protein_cap lets protein foods shrink', () => {
  const lunch = N.days[0].meals.find((m) => m.slot === 'lunch').options[0];
  const plain = scaleOption(lunch, 0.75, N.foods);
  const capped = scaleOption(lunch, 0.75, N.foods, { proteinCap: true });
  assert.ok(capped.protein < plain.protein, `${capped.protein} < ${plain.protein}`);
  assert.ok(Math.abs(capped.kcal - lunch.kcal * 0.75) / (lunch.kcal * 0.75) <= OPTION_TOLERANCE);
});

test('golden: Yusuf at 1,939 kcal and anyone without a profile see the plan exactly as written', () => {
  const yusuf = personAt(1939);
  assert.ok(Math.abs(yusuf.got - 1939) < 20, `found ${yusuf.got}`);
  const fit = planFit(yusuf.d, N, TODAY);
  assert.equal(fit.state, 'same');
  for (const d of [yusuf.d, emptyData(content)]) {
    for (let i = 0; i < 14; i += 1) {
      const iso = `2026-11-${String(i + 1).padStart(2, '0')}`;
      const got = planDayFor(iso, d, N, TODAY);
      assert.equal(got.day, mealDayFor(iso, N), 'the content object itself');
    }
    const fitted = (iso) => planDayFor(iso, d, N, TODAY).day;
    assert.deepEqual(shoppingList(TODAY, N, 14, () => null, N.plan_start_date, fitted), shoppingList(TODAY, N, 14, () => null));
    assert.deepEqual(widgetDays(d, content, TODAY), widgetDays({ ...d }, content, TODAY));
  }
  assert.equal(planFit(emptyData(content), N, TODAY).state, 'same');
});

test('a 1,500 kcal friend: smaller days, scaled shopping, scaled widget text', () => {
  const friend = personAt(1500);
  const fit = planFit(friend.d, N, TODAY);
  assert.equal(fit.state, 'scaled');
  // 13 Nov is plan day 4, the protein-heavy day that can't drop that far; 14 Nov is day 5.
  assert.equal(planDayFor(TODAY, friend.d, N, TODAY).fit.state, 'far');
  const iso = '2026-11-14';
  const { day, fit: f } = planDayFor(iso, friend.d, N, TODAY);
  const plain = mealDayFor(iso, N);
  assert.equal(f.state, 'scaled');
  assert.ok(dayKcal(day) < dayKcal(plain));
  // Same answer from the cache.
  assert.equal(planDayFor(iso, friend.d, N, TODAY).day, day);

  // Shopping sums the scaled units: less rice and bread over a week.
  const fitted = (iso) => planDayFor(iso, friend.d, N, TODAY).day;
  const flat = (groups) => Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.key, i.qty])));
  const scaled = flat(shoppingList(TODAY, N, 7, () => null, N.plan_start_date, fitted));
  const asWritten = flat(shoppingList(TODAY, N, 7, () => null));
  assert.deepEqual(Object.keys(scaled).sort(), Object.keys(asWritten).sort(), 'same foods to buy');
  assert.notDeepEqual(scaled, asWritten);
  assert.ok(parseFloat(scaled['white_rice|g']) <= parseFloat(asWritten['white_rice|g']));

  // The widget's food line follows the scaled portions.
  const w = widgetDays(friend.d, content, TODAY);
  const tomorrow = w.find((e) => e.date === iso);
  const scaledWhat = day.meals.map((m) => m.options[0].ingredients.join(', ').toLowerCase());
  assert.ok(tomorrow.meals.some((m) => scaledWhat.includes(m.what.toLowerCase())), 'scaled text on the widget');
});

test('too far: a 1,100 kcal target shows the plan as written, state far', () => {
  const tiny = personAt(1100);
  const fit = planFit(tiny.d, N, TODAY);
  if (fit.raw >= CLAMP[0]) return; // the search could not get that low
  const { day, fit: f } = planDayFor(TODAY, tiny.d, N, TODAY);
  assert.equal(f.state, 'far');
  assert.equal(day, mealDayFor(TODAY, N));
});

test('a scaled day that misses 5% falls back to the plan as written', () => {
  // Day 4 is protein-heavy: at 0.7 it can't get there without cutting protein.
  const day4 = N.days.find((d) => d.day_index === 4);
  assert.equal(scaleDay(day4, 0.7, N).fits, false);
  const iso = N.plan_start_date.replace(/\d\d$/, (dd) => String(Number(dd) + 3).padStart(2, '0'));
  const fit = { state: 'scaled', factor: 0.7, plan: 1920, cap: false };
  const got = planDayFor(iso, emptyData(content), N, TODAY, fit);
  if (mealDayFor(iso, N).day_index !== 4) return;
  assert.equal(got.fit.state, 'far');
  assert.equal(got.day, day4);
});
