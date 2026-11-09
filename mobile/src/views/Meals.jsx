import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import { addDays, formatDate } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { macroTargets } from '../lib/macros.js';
import { mealsView, proteinPerMeal, servingsFor, setMealsView } from '../lib/mealsView.js';
import { dayDrift } from '../lib/macroCheck.js';
import { dayTotals, mealDayFor, slotLabel } from '../lib/meals.js';
import { sessionKeyOn } from '../lib/schedule.js';
import { effectiveTimes, ramadanActive } from '../lib/ramadan.js';
import { activePlan } from '../lib/plan.js';
import { mealWhat } from '../lib/widget.js';
import CountUp from '../components/CountUp.jsx';
import { mealTickEvent } from '../lib/rewards.js';
import { feedback } from '../store/feedback.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

const N = content.nutrition;

const WATER_GOAL = 3000;

/** Meals opens on the simple targets view or the full plan (E3-S9). */
export default function Meals() {
  const { data } = useData();
  return mealsView(data, N) === 'targets' ? <Targets /> : <MealPlan />;
}

function SwitchView({ to }) {
  const { update } = useData();
  return (
    <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => update((d) => setMealsView(d, to))}>
      {t(to === 'plan' ? 'mealsSimple.toPlan' : 'mealsSimple.toTargets')}
    </button>
  );
}

/** Targets only: protein (and kcal unless hidden), water, everyday foods. */
function Targets() {
  const { data, update } = useData();
  const today = useToday();
  const target = macroTargets(data, N, today);
  const S = N.simple;
  const perMeal = proteinPerMeal(target.protein, S.meals_per_day);
  const water = D.waterOn(data, today);
  const showKcal = !data.safety?.hide_kcal && target.source !== 'plan';
  return (
    <div className="page">
      <h1 className="page-title">{t('mealsSimple.title')}</h1>
      <p className="page-sub">{t('mealsSimple.sub')}</p>
      <section className="card">
        <div className="muted small">{t('mealsSimple.proteinLabel')}</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 6, margin: '4px 0 6px' }}>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{target.protein}</span><span className="muted">{t('mealsSimple.gramsDay')}</span>
        </div>
        <div className="small">{t('mealsSimple.perMeal', { g: perMeal, n: S.meals_per_day })}</div>
        {showKcal ? <div className="muted small" style={{ marginTop: 6 }}>{t('mealsSimple.kcal', { kcal: target.kcal })}</div> : null}
        {target.source === 'plan' ? <div className="muted small" style={{ marginTop: 6 }}><Link to="/profile">{t('mealsSimple.setUp')}</Link></div> : null}
        <div className="row between" style={{ marginTop: 14 }}>
          <strong><Icon name="drop" className="icon" /> {t('mealsSimple.water')}</strong>
          <span className="muted small">{water} / {WATER_GOAL} ml</span>
        </div>
        <div className="progress" style={{ margin: '10px 0 12px' }}><span style={{ transform: `scaleX(${(Math.min(100, (water / WATER_GOAL) * 100)) / 100})` }} /></div>
        <div className="row">
          <button type="button" className="btn secondary small grow" onClick={() => { update((d) => D.addWater(d, today, 250)); feedback('water'); }}>{t('mealsSimple.add250')}</button>
          <button type="button" className="btn secondary small grow" onClick={() => { update((d) => D.addWater(d, today, 500)); feedback('water'); }}>{t('mealsSimple.add500')}</button>
        </div>
      </section>

      <div className="section-label">{t('mealsSimple.foodsTitle', { g: perMeal })}</div>
      <div className="list">
        {S.protein_foods.map((f) => (
          <div key={f.name} className="list-row">
            <div className="grow"><div>{f.name}</div><div className="meta small">{t('mealsSimple.serving', { serving: f.serving, g: f.protein_g })}</div></div>
            {perMeal ? <span className="chip">{t('mealsSimple.times', { n: servingsFor(f, perMeal) })}</span> : null}
          </div>
        ))}
      </div>

      <div className="section-label">{t('mealsSimple.plateTitle')}</div>
      <section className="card">
        <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
          {S.plate_guide.map((line) => <li key={line} style={{ margin: '4px 0' }}>{line}</li>)}
        </ul>
      </section>
      <SwitchView to="plan" />
    </div>
  );
}

function MealPlan() {
  const { data, update } = useData();
  const today = useToday();
  const [date, setDate] = useState(today);
  // Looking at today when midnight passes: follow the new day.
  const shownToday = useRef(today);
  useEffect(() => {
    if (shownToday.current === today) return;
    setDate((d) => (d === shownToday.current ? today : d));
    shownToday.current = today;
  }, [today]);
  const day = mealDayFor(date, N);
  const picks = Object.fromEntries(N.meal_slots.map((s) => [s, D.mealLog(data, date, s)?.option_key || 'option_a']));
  const totals = dayTotals(day, picks);
  const training = sessionKeyOn(date, activePlan(data, content), data.session_moves || []) !== 'rest';
  const target = macroTargets(data, N, today);
  const eatenSlots = new Set(N.meal_slots.filter((s) => D.mealLog(data, date, s)?.completed));
  const done = eatenSlots.size;
  const eaten = dayTotals(day, picks, eatenSlots);
  // Ramadan: the same meals, at suhoor, iftar and after taraweeh.
  const fasting = ramadanActive(data, date);
  const rTimes = fasting ? effectiveTimes(data, content, date).meal_times : null;
  const label = (slot) => (fasting ? t(`ramadan.meal.${slot}`) : slotLabel(slot));

  return (
    <div className="page">
      <div className="row between">
        <h1 className="page-title">Meals</h1>
        <Link to="/shopping" className="btn secondary small"><Icon name="cart" /> Shopping</Link>
      </div>
      <div className="row between card" style={{ padding: 6 }}>
        <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><Icon name="back" /></button>
        <div style={{ textAlign: 'center' }}>
          <div><strong>{date === today ? 'Today' : formatDate(date)}</strong></div>
          <div className="muted small">{day.label}{day.is_refeed ? ' · refeed' : ''}</div>
        </div>
        <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><Icon name="chev" /></button>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="label">{t('meals.kcalEaten')}</div><div className="value"><CountUp value={eaten.kcal} /><span className="unit">/ {target.kcal}</span></div></div>
        <div className="stat"><div className="label">{t('meals.proteinEaten')}</div><div className="value"><CountUp value={eaten.protein} /><span className="unit">/ {target.protein} g</span></div></div>
      </div>
      <div className="muted small" style={{ margin: '-4px 4px 12px' }}>{t('meals.summary', { carbs: eaten.carbs, tc: target.carbs, fat: eaten.fat, tf: target.fat, done, all: N.meal_slots.length, kcal: totals.kcal, protein: totals.protein })} <Link to="/profile">{target.source === 'profile' ? t('meals.yourTargets') : t('meals.setTargets')}</Link></div>
      {dayDrift(totals, target).map((r) => (
        <div key={r.key} className="warn" role="note">
          {r.label} with these picks: {r.total} {r.unit}, {Math.round(Math.abs(r.diff) * 100)}% {r.over ? 'over' : 'under'} your {r.target} {r.unit} target.
          {day.is_refeed && r.key === 'kcal' && r.over ? ' It is a refeed day, so a little over is planned.' : r.key === 'protein' && !r.over ? ' Try the other option on a meal, or add a protein snack.' : ''}
        </div>
      ))}
      {fasting ? <div className="card small"><span className="chip accent">{t('ramadan.chip')}</span> <span className="muted">{t('ramadan.mealsNote')}</span></div>
        : training ? <div className="card small"><span className="chip accent">Training day</span> <span className="muted">{N.pre_workout_note}</span></div> : null}

      {day.meals.map((meal) => {
        const log = D.mealLog(data, date, meal.slot);
        const pick = picks[meal.slot];
        const opt = meal.options.find((o) => o.key === pick) || meal.options[0];
        return (
          <section key={meal.slot} className="card">
            <div className="row between">
              <div>
                <strong>{label(meal.slot)}</strong>
                <div className="muted small">{fasting ? rTimes[meal.slot] : meal.time_window}</div>
              </div>
              <button type="button" className={`check${log?.completed ? ' on' : ''}`} aria-pressed={!!log?.completed} aria-label={`${label(meal.slot)} eaten`}
                onClick={() => {
                  const ev = mealTickEvent({ nowDone: !log?.completed, doneBefore: done, slots: N.meal_slots.length });
                  update((d) => D.setMeal(d, date, meal.slot, { completed: !log?.completed, option_key: pick }));
                  if (ev) feedback(ev);
                }}>
                {log?.completed ? <Icon name="check" /> : null}
              </button>
            </div>
            <div className="seg" style={{ margin: '12px 0 10px' }}>
              {meal.options.map((o, i) => (
                <button key={o.key} type="button" className={o.key === opt.key ? 'on' : ''} onClick={() => update((d) => D.setMeal(d, date, meal.slot, { option_key: o.key }))}>
                  {String.fromCharCode(65 + i)} · {o.cuisine}
                </button>
              ))}
            </div>
            <div>{mealWhat(opt)}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{opt.kcal} kcal · {opt.protein} g protein · {opt.carbs} g carbs · {opt.fat} g fat</div>
          </section>
        );
      })}
      <SwitchView to="targets" />
    </div>
  );
}
