import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import MealRow from '../components/MealRow.jsx';
import { addDays, formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { goalDirection } from '../lib/macros.js';
import { byProtein, dayFor, filterMeals, ingredientSet, kindsFor, pickCounts, recentKeys, recommend, shownOption, sortForGoal, swapTarget } from '../lib/mealLibrary.js';
import { slotLabel } from '../lib/meals.js';
import { planFit } from '../lib/portions.js';
import { ramadanActive } from '../lib/ramadan.js';
import { kcalHidden, safeMode } from '../lib/safety.js';
import { useToday } from '../store/today.js';
import { content, useData } from '../store/useData.js';

const N = content.nutrition;
const KINDS = ['breakfast', 'lunch', 'dinner', 'snack', 'suhoor', 'iftar'];

export default function MealLibrary() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const data = useData((s) => s.data);
  const today = useToday();
  const swap = swapTarget(params, today, N.meal_slots);
  const fasting = swap ? ramadanActive(data, swap.date) : false;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState(swap ? kindsFor(swap.slot, N, fasting)[0] : null);
  const [tags, setTags] = useState([]);
  const [byGoal, setByGoal] = useState(true);
  const fit = useMemo(() => planFit(data, N, today), [data, today]);
  const goal = safeMode(data, goalDirection(data), today);
  const hideKcal = kcalHidden(data);

  const list = useMemo(() => {
    let out = filterMeals(N.library, { query, tags, nutrition: N });
    if (kind) out = out.filter((m) => m.meals.includes(kind));
    return byGoal ? sortForGoal(out, goal) : [...out].sort((a, b) => (a.name < b.name ? -1 : 1));
  }, [query, tags, kind, byGoal, goal]);

  // Swap mode: recommendations for this slot and person.
  const recs = useMemo(() => {
    if (!swap) return [];
    const { day } = dayFor(swap.date, data, N, today, fit);
    const meal = day.meals.find((m) => m.slot === swap.slot);
    const log = (data.meal_logs || []).find((m) => m.log_date === swap.date && m.meal_slot === swap.slot);
    const current = meal ? shownOption(meal, log?.option_key) : null;
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      const d = dayFor(addDays(today, i), data, N, today, fit).day;
      for (const m of d.meals) week.push(shownOption(m, (data.meal_logs || []).find((l) => l.log_date === addDays(today, i) && l.meal_slot === m.slot)?.option_key));
    }
    return recommend(swap.slot, N, {
      goal,
      fasting,
      counts: pickCounts(data.meal_logs, N),
      weekIngredients: ingredientSet(week),
      recent: recentKeys(data.meal_logs, addDays(swap.date, -2)),
      exclude: current?.key,
      slotKcal: current?.kcal,
      factor: 1,
    });
  }, [swap?.slot, swap?.date, data, today, fit, goal, fasting]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = (key) => `/meals/library/${encodeURIComponent(key)}${swap ? `?slot=${swap.slot}&date=${swap.date}` : ''}`;
  const toggleTag = (tag) => setTags((all) => (all.includes(tag) ? all.filter((x) => x !== tag) : [...all, tag]));

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> {t('nav.back')}</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{swap ? t('lib.swapFor', { meal: slotLabel(swap.slot), date: formatDate(swap.date) }) : t('lib.title')}</h1>
      <p className="page-sub">{swap ? t('lib.swapNote') : t('lib.sub', { n: N.library.length })}</p>

      {recs.length ? (
        <>
          <div className="section-label">{t('lib.recommended')}</div>
          <div className="list">
            {recs.map((r) => <MealRow key={r.meal.key} meal={r.meal} fit={fit} hideKcal={hideKcal} to={detail(r.meal.key)} reasons={r.reasons} />)}
          </div>
        </>
      ) : null}

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('lib.search')} aria-label={t('lib.search')} style={{ margin: '16px 0 10px' }} />
      <div className="chip-row" role="group" aria-label={t('lib.title')}>
        <button type="button" className={`chip${kind ? '' : ' accent'}`} onClick={() => setKind(null)}>{t('lib.all')}</button>
        {KINDS.map((k) => <button key={k} type="button" className={`chip${kind === k ? ' accent' : ''}`} onClick={() => setKind(kind === k ? null : k)}>{t(`lib.kind.${k}`)}</button>)}
      </div>
      <div className="chip-row">
        {N.library_tags.map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} className={`chip${tags.includes(tag) ? ' accent' : ''}`} onClick={() => toggleTag(tag)}>{t(`lib.tag.${tag}`)}</button>)}
      </div>
      <div className="chip-row">
        <button type="button" aria-pressed={byGoal} className={`chip${byGoal ? ' accent' : ''}`} onClick={() => setByGoal(true)}>{t('lib.sortGoal')}</button>
        <button type="button" aria-pressed={!byGoal} className={`chip${byGoal ? '' : ' accent'}`} onClick={() => setByGoal(false)}>{t('lib.sortName')}</button>
      </div>

      {list.length ? byProtein(list, N.library_proteins).map((g) => (
        <div key={g.protein}>
          <div className="section-label">{t(`lib.protein.${g.protein}`)}</div>
          <div className="list">
            {g.meals.map((m) => <MealRow key={m.key} meal={m} fit={fit} hideKcal={hideKcal} to={detail(m.key)} />)}
          </div>
        </div>
      )) : <div className="card empty">{t('lib.none')}</div>}
    </div>
  );
}
