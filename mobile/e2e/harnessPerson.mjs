// The harness's person (TEST-1 part B): today's data shape, not a v1 file.
// Built from the Yusuf-like fixture through the real upgrade, then given
// what newer screens read: saved foods, a water goal, safety answers and a
// week of ticked meals (one of them "something else"). Synthetic: no real
// person's numbers. v1-yusuf-like.json itself stays for the goldens.
import { readFileSync } from 'node:fs';

import { addDays } from '../src/lib/dates.js';
import { mealDayFor } from '../src/lib/meals.js';
import { tickMeal } from '../src/lib/meals.js';
import { migrate } from '../src/lib/migrate.js';
import { logCustomMeal, rememberFood } from '../src/lib/myFoods.js';
import { SCREENED } from './bigFixture.mjs';

const content = JSON.parse(readFileSync(new URL('../src/content.json', import.meta.url), 'utf8'));
const v1 = JSON.parse(readFileSync(new URL('../src/lib/fixtures/v1-yusuf-like.json', import.meta.url), 'utf8'));

export const TODAY = '2026-11-06';

/** The person, as a plain object ready for localStorage. */
export function harnessPerson() {
  let d = migrate(structuredClone(v1), content);
  d = { ...d, safety: SCREENED, settings: { ...d.settings, water_goal_ml: 2500 } };
  d = rememberFood(d, { name: 'Koshari', kcal: 700, protein: 20 });
  d = rememberFood(d, { name: 'Chicken shawarma wrap', kcal: 550, protein: 35 });
  const N = content.nutrition;
  for (let i = 7; i >= 1; i -= 1) {
    const date = addDays(TODAY, -i);
    for (const meal of mealDayFor(date, N, d.diet?.plan_start_date || N.plan_start_date).meals) {
      if (i === 3 && meal.slot === 'lunch') d = logCustomMeal(d, date, meal.slot, { name: 'Koshari', kcal: 700, protein: 20 });
      else d = tickMeal(d, date, meal.slot, meal.options[0], true);
    }
  }
  return d;
}
