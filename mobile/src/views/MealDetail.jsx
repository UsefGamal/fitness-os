import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import { useMealPhoto } from '../components/useMealPhoto.js';
import MealRow from '../components/MealRow.jsx';
import { formatDate } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { goalDirection } from '../lib/macros.js';
import { goalFit, libraryMeal, similarMeals, suits, swapTarget } from '../lib/mealLibrary.js';
import { pickOption, slotLabel } from '../lib/meals.js';
import { fitOption, planFit } from '../lib/portions.js';
import { ramadanActive } from '../lib/ramadan.js';
import { kcalHidden, safeMode } from '../lib/safety.js';
import { useToday } from '../store/today.js';
import { content, useData } from '../store/useData.js';

const N = content.nutrition;

/** A library meal: the portion fitted to the person, ingredients, method,
 * similar meals, and the swap into a plan slot. */
export default function MealDetail() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const swap = swapTarget(params, today, N.meal_slots);
  const meal = libraryMeal(key, N);
  const photo = useMealPhoto(meal?.photo);
  const fit = useMemo(() => planFit(data, N, today), [data, today]);
  const [done, setDone] = useState('');
  if (!meal) return <div className="page"><div className="card empty">{t('lib.notFound')}</div></div>;

  const shown = fitOption(meal, fit, N);
  const scaled = shown !== meal && shown.changed;
  const hideKcal = kcalHidden(data);
  const goal = safeMode(data, goalDirection(data), today);
  const date = swap?.date || today;
  const fasting = ramadanActive(data, date);
  // Slots this meal can go into: the one being swapped, or every slot it suits today.
  const slots = swap ? [swap.slot] : N.meal_slots.filter((s) => suits(meal, s, N, fasting));
  const similar = similarMeals(meal, N, { slot: swap?.slot ?? null, fasting });
  const query = swap ? `?slot=${swap.slot}&date=${swap.date}` : '';

  const use = (slot) => {
    update((d) => pickOption(d, date, slot, shown));
    if (swap) navigate(`/meals?date=${date}`, { replace: true });
    else setDone(t('lib.used', { name: meal.name, meal: slotLabel(slot).toLowerCase() }));
  };
  const already = (slot) => D.mealLog(data, date, slot)?.option_key === meal.key;

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> {t('nav.back')}</button>
      {photo.shown ? <img className="meal-hero" src={photo.shown.file} alt="" decoding="async" onError={photo.onError} /> : null}
      <h1 className="page-title" style={{ marginTop: 4 }}>{meal.name}</h1>
      <div className="chip-row">
        <span className="chip"><Icon name="timer" className="icon inline" /> {meal.minutes} min</span>
        <span className="chip">{t(`lib.protein.${meal.protein_source}`)}</span>
        {meal.tags.map((tag) => <span key={tag} className="chip">{t(`lib.tag.${tag}`)}</span>)}
      </div>

      <div className="tile-grid">
        {hideKcal ? null : <div className="stat-tile macro"><div className="stat-tile-label">{t('lib.kcal')}</div><div className="macro-value">{Math.round(shown.kcal)}</div></div>}
        <div className="stat-tile macro"><div className="stat-tile-label">{t('lib.proteinLabel')}</div><div className="macro-value">{Math.round(shown.protein)}<span className="unit">g</span></div></div>
      </div>
      <p className="muted small" style={{ margin: '4px 4px 0' }}>{t('lib.carbsFat', { carbs: Math.round(shown.carbs), fat: Math.round(shown.fat), fiber: Math.round(shown.fiber) })}{scaled ? ` · ${t('lib.scaledNote')}` : ''}</p>
      {goalFit(meal, goal) >= 0.7 ? <p className="small accent-line" style={{ margin: '8px 4px 0' }}><Icon name="check" className="icon inline" /> {t('lib.goalGood')}: {t(`lib.why.goal.${goal}`).toLowerCase()}</p> : null}

      {slots.length ? (
        <section className="card stack" style={{ marginTop: 16 }}>
          {swap ? null : <div className="muted small">{t('lib.addToday')}</div>}
          {slots.map((slot) => (
            <button key={slot} type="button" className={already(slot) ? 'btn secondary' : 'btn'} disabled={already(slot)} onClick={() => use(slot)}>
              <Icon name="check" /> {swap ? t('lib.useOn', { meal: slotLabel(slot).toLowerCase(), date: formatDate(date) }) : t('lib.use', { meal: slotLabel(slot).toLowerCase() })}
            </button>
          ))}
          {done ? <p className="small accent-line" role="status" style={{ margin: 0 }}>{done}</p> : null}
        </section>
      ) : null}

      <div className="section-label">{t('lib.ingredients')}{scaled ? ` · ${t('lib.yourPortion')}` : ''}</div>
      <div className="list">
        {shown.ingredients.map((line) => <div key={line} className="list-row"><div className="grow">{line.charAt(0).toUpperCase() + line.slice(1)}</div></div>)}
      </div>
      {meal.pantry.length ? <p className="muted small" style={{ margin: '8px 16px 0' }}>{t('lib.pantry', { items: meal.pantry.join(', ') })}</p> : null}

      <div className="section-label">{t('lib.method')}</div>
      <ol className="card method-steps">
        {meal.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>

      {similar.length ? (
        <>
          <div className="section-label">{t('lib.similar')}</div>
          <div className="list">
            {similar.map(({ meal: m }) => <MealRow key={m.key} meal={m} fit={fit} hideKcal={hideKcal} to={`/meals/library/${encodeURIComponent(m.key)}${query}`} />)}
          </div>
        </>
      ) : null}
      <p className="muted small" style={{ margin: '16px 4px 0' }}>{t('lib.source', { source: N.nutrition_source })}</p>
      {photo.shown ? <p className="muted small" style={{ margin: '4px 4px 0' }}>{t('lib.photoCredit', { author: photo.shown.author, license: photo.shown.license })}</p> : null}
    </div>
  );
}
