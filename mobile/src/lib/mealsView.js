// Which Meals page someone sees (E3-S9): 'targets' (protein and water
// targets with general guidance) or 'plan' (the full 14-day meal plan).
// The build sets the default (content.nutrition.meals_default); a choice
// made on the page is kept in settings.meals_view.

export const VIEWS = ['targets', 'plan'];

export function mealsView(data, nutrition) {
  const own = data.settings?.meals_view;
  if (VIEWS.includes(own)) return own;
  return VIEWS.includes(nutrition.meals_default) ? nutrition.meals_default : 'plan';
}

export function setMealsView(data, view) {
  if (!VIEWS.includes(view)) return data;
  return { ...data, settings: { ...(data.settings || {}), meals_view: view } };
}

/** Protein to aim for at each meal, to the nearest 5 g. */
export function proteinPerMeal(proteinG, meals = 4) {
  if (!proteinG || !meals) return null;
  return Math.round(proteinG / meals / 5) * 5;
}

/** How many servings of each food make one meal's protein, e.g. 1.5. */
export function servingsFor(food, perMeal) {
  if (!perMeal || !food.protein_g) return null;
  return Math.max(0.5, Math.round((perMeal / food.protein_g) * 2) / 2);
}
