import { useState } from 'react';
import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import { addDays, formatDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { macroTargets } from '../lib/macros.js';
import { dayTotals, mealDayFor, slotLabel } from '../lib/meals.js';
import { sessionKeyOn } from '../lib/schedule.js';
import { content, useData } from '../store/useData.js';

const N = content.nutrition;

export default function Meals() {
  const { data, update } = useData();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const day = mealDayFor(date, N);
  const picks = Object.fromEntries(N.meal_slots.map((s) => [s, D.mealLog(data, date, s)?.option_key || 'option_a']));
  const totals = dayTotals(day, picks);
  const training = sessionKeyOn(date, content.training, data.session_moves || []) !== 'rest';
  const target = macroTargets(data, N, today);
  const done = N.meal_slots.filter((s) => D.mealLog(data, date, s)?.completed).length;

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
        <div className="stat"><div className="label">Calories</div><div className="value">{totals.kcal}<span className="unit">/ {target.kcal}</span></div></div>
        <div className="stat"><div className="label">Protein</div><div className="value">{totals.protein}<span className="unit">/ {target.protein} g</span></div></div>
      </div>
      <div className="muted small" style={{ margin: '-4px 4px 12px' }}>Carbs {totals.carbs}/{target.carbs} g · fat {totals.fat}/{target.fat} g · {done}/{N.meal_slots.length} eaten · <Link to="/profile">{target.source === 'profile' ? 'your targets' : 'set your targets'}</Link></div>
      {training ? <div className="card small"><span className="chip accent">Training day</span> <span className="muted">{N.pre_workout_note}</span></div> : null}

      {day.meals.map((meal) => {
        const log = D.mealLog(data, date, meal.slot);
        const pick = picks[meal.slot];
        const opt = meal.options.find((o) => o.key === pick) || meal.options[0];
        return (
          <section key={meal.slot} className="card">
            <div className="row between">
              <div>
                <strong>{slotLabel(meal.slot)}</strong>
                <div className="muted small">{meal.time_window}</div>
              </div>
              <button type="button" className={`check${log?.completed ? ' on' : ''}`} aria-pressed={!!log?.completed} aria-label={`${slotLabel(meal.slot)} eaten`}
                onClick={() => update((d) => D.setMeal(d, date, meal.slot, { completed: !log?.completed, option_key: pick }))}>
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
            <div>{opt.ingredients.join(', ')}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{opt.kcal} kcal · {opt.protein} g protein · {opt.carbs} g carbs · {opt.fat} g fat</div>
          </section>
        );
      })}
    </div>
  );
}
