// Checks on the meal plan's numbers, all offline: does each option's
// calorie count agree with its protein, carbs and fat (4/4/9 kcal per g),
// with the foods it lists, and does the day you picked land within 10% of
// your targets. Pure helpers, tested in macroCheck.test.js.

export const DRIFT = 0.1;

/** kcal from macros (Atwater 4/4/9). */
export function atwater({ protein = 0, carbs = 0, fat = 0 }) {
  return 4 * protein + 4 * carbs + 9 * fat;
}

/** Problems with one meal option: [{ kind, text }]. */
export function optionIssues(option, foods = {}, tolerance = 0.15) {
  const out = [];
  const fromMacros = atwater(option);
  if (option.kcal && Math.abs(fromMacros - option.kcal) / option.kcal > tolerance) {
    out.push({ kind: 'atwater', text: `${option.kcal} kcal listed, but the macros add up to about ${Math.round(fromMacros)} kcal` });
  }
  const items = option.items || [];
  if (items.length && items.every((k) => foods[k])) {
    const sum = items.reduce((n, k) => n + foods[k][0], 0);
    if (option.kcal && Math.abs(sum - option.kcal) / option.kcal > tolerance) {
      out.push({ kind: 'foods', text: `${option.kcal} kcal listed, but its foods add up to ${Math.round(sum)} kcal` });
    }
  }
  return out;
}

/** How a day's totals compare to the targets: [{ key, label, total,
 * target, diff (fraction), over }] for calories and protein that drift
 * more than 10%. */
export function dayDrift(totals, target, drift = DRIFT) {
  const rows = [['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g']];
  return rows
    .filter(([k]) => target[k])
    .map(([key, label, unit]) => ({ key, label, unit, total: totals[key], target: target[key], diff: (totals[key] - target[key]) / target[key] }))
    .filter((r) => Math.abs(r.diff) > drift)
    .map((r) => ({ ...r, over: r.diff > 0 }));
}

/** Every option in the plan with an issue: [{ day, slot, key, issues }]. */
export function planIssues(nutrition) {
  const out = [];
  for (const day of nutrition.days) {
    for (const meal of day.meals) {
      for (const opt of meal.options) {
        const issues = optionIssues(opt, nutrition.foods);
        if (issues.length) out.push({ day: day.day_index, slot: meal.slot, key: opt.key, issues });
      }
    }
  }
  return out;
}
