import { useMemo } from 'react';
import { Link } from 'react-router';

import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { t } from '../lib/i18n.js';
import { libraryMeal } from '../lib/mealLibrary.js';
import { fitOption, planFit } from '../lib/portions.js';
import { kcalHidden } from '../lib/safety.js';
import { content, useData } from '../store/useData.js';

const N = content.nutrition;

/** MOVE-2: a quick look at a meal's recipe from the Meals page, without
 * leaving it: your portion's macros, the ingredients and the steps, with
 * the full page (photo, similar meals, swaps) one tap away. */
export default function RecipeSheet({ mealKey, slot, date, onClose }) {
  const data = useData((s) => s.data);
  const meal = libraryMeal(mealKey, N);
  const fit = useMemo(() => planFit(data, N, date), [data, date]);
  if (!meal) return null;
  const shown = fitOption(meal, fit, N);
  const scaled = shown !== meal && shown.changed;
  const hideKcal = kcalHidden(data);
  return (
    <Sheet title={meal.name} onClose={onClose}>
      <div className="chip-row">
        <span className="chip"><Icon name="timer" className="icon inline" /> {meal.minutes} min</span>
        {hideKcal ? null : <span className="chip">{Math.round(shown.kcal)} {t('lib.kcal')}</span>}
        <span className="chip">{Math.round(shown.protein)} g {t('lib.proteinLabel').toLowerCase()}</span>
      </div>
      <div className="section-label">{t('lib.ingredients')}{scaled ? ` · ${t('lib.yourPortion')}` : ''}</div>
      <div className="list">
        {shown.ingredients.map((line) => <div key={line} className="list-row"><div className="grow">{line.charAt(0).toUpperCase() + line.slice(1)}</div></div>)}
      </div>
      <div className="section-label">{t('lib.method')}</div>
      <ol className="card method-steps">
        {meal.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <Link className="btn secondary" to={`/meals/library/${encodeURIComponent(meal.key)}?slot=${slot}&date=${date}`}><Icon name="book" /> {t('meals.fullRecipe')}</Link>
    </Sheet>
  );
}
