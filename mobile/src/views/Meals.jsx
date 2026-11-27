import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import RecipeSheet from '../components/RecipeSheet.jsx';
import { MealThumb } from '../components/MealPhoto.jsx';
import { addDays, formatDate, fromISO, LOCALE } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { macroTargets } from '../lib/macros.js';
import { mealsView, proteinPerMeal, servingsFor, setMealsView } from '../lib/mealsView.js';
import { dayDrift } from '../lib/macroCheck.js';
import { dayTotals, eatenMeals, pickOption, slotLabel, tickMeal } from '../lib/meals.js';
import { dayFor, shownOption } from '../lib/mealLibrary.js';
import { portionsOf } from '../lib/portions.js';
import { sessionKeyOn } from '../lib/schedule.js';
import { effectiveTimes, mealDay, ramadanActive } from '../lib/ramadan.js';
import { activePlan } from '../lib/plan.js';
import { mealWhat } from '../lib/widget.js';
import CountUp from '../components/CountUp.jsx';
import { fillTone } from '../lib/motion.js';
import OtherFoodSheet from '../components/OtherFoodSheet.jsx';
import { clearCustomMeal, customMeals } from '../lib/myFoods.js';
import { mealTickEvent } from '../lib/rewards.js';
import { feedback } from '../store/feedback.js';
import { content, useData } from '../store/useData.js';
import { gateOn, kcalHidden } from '../lib/safety.js';
import { mealWeek } from '../lib/mealWeek.js';
import { clearAdjustments } from '../lib/targetCheck.js';
import { announce, mealTickLine } from '../lib/announce.js';
import { useToday } from '../store/today.js';
import useViewState from '../components/useViewState.js';

const pad2 = (n) => String(n).padStart(2, '0');
const clock = () => { const n = new Date(); return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`; };

const N = content.nutrition;

/** Meals opens on the simple targets view or the full plan (E3-S9). */
export default function Meals() {
  const data = useData((s) => s.data);
  return mealsView(data, N) === 'targets' ? <Targets /> : <MealPlan />;
}

function SwitchView({ to }) {
  const update = useData((s) => s.update);
  return (
    <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => update((d) => setMealsView(d, to))}>
      {t(to === 'plan' ? 'mealsSimple.toPlan' : 'mealsSimple.toTargets')}
    </button>
  );
}

/** Targets only: protein (and kcal unless hidden), water, everyday foods. */
function Targets() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const target = macroTargets(data, N, today);
  const S = N.simple;
  const perMeal = proteinPerMeal(target.protein, S.meals_per_day);
  const water = D.waterOn(data, today);
  const WATER_GOAL = D.waterGoal(data);
  const showKcal = !kcalHidden(data) && target.source !== 'plan';
  // Ticks only, no plan numbers: the person eats their own food here.
  const eatenSlots = new Set(N.meal_slots.filter((s) => D.mealLog(data, today, s)?.completed));
  const done = eatenSlots.size;
  return (
    <div className="page">
      <div className="plan-head">
        <h1 className="page-title">{t('mealsSimple.title')}</h1>
        <Link to="/shopping" className="chip big-chip"><Icon name="cart" className="icon" /> {t('meals.shopping')}</Link>
      </div>
      <p className="page-sub" style={{ marginTop: 4 }}>{t('mealsSimple.sub')}</p>
      <section className="card">
        <div className="muted small">{t('mealsSimple.proteinLabel')}</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 6, margin: '4px 0 6px' }}>
          <span className="hero-num">{target.protein}</span><span className="muted">{t('mealsSimple.gramsDay')}</span>
        </div>
        <div className="small">{t('mealsSimple.perMeal', { g: perMeal, n: S.meals_per_day })}</div>
        {showKcal ? <div className="muted small" style={{ marginTop: 6 }}>{t('mealsSimple.kcal', { kcal: target.kcal })}</div> : null}
        {showKcal && target.reverse && !target.reverse.done ? <div className="muted small" style={{ marginTop: 4 }}>{t(target.reverse.heldLast ? 'maint.held' : 'maint.week', { week: target.reverse.week, weeks: target.reverse.weeks, kcal: target.kcal, next: formatDate(target.reverse.next_on) })}</div> : null}
        {target.source === 'plan' ? <div className="muted small" style={{ marginTop: 6 }}><Link to="/profile">{t('mealsSimple.setUp')}</Link></div> : null}
        <div className="row between" style={{ marginTop: 14 }}>
          <strong><Icon name="drop" className="icon tone-water" /> {t('mealsSimple.water')}</strong>
          <span className="muted small">{water} / {WATER_GOAL} ml</span>
        </div>
        <div className={`progress water ${fillTone(water, WATER_GOAL, { overAt: Infinity })}`} style={{ margin: '10px 0 12px' }}><span style={{ transform: `scaleX(${(Math.min(100, (water / WATER_GOAL) * 100)) / 100})` }} /></div>
        <div className="row">
          <button type="button" className="btn secondary small grow" onClick={() => { update((d) => D.addWater(d, today, 250)); feedback('water'); }}>{t('mealsSimple.add250')}</button>
          <button type="button" className="btn secondary small grow" onClick={() => { update((d) => D.addWater(d, today, 500)); feedback('water'); }}>{t('mealsSimple.add500')}</button>
        </div>
      </section>

      <div className="section-head"><h2 className="section-title">{t('meals.todays')}</h2><span className="muted small">{t('meals.eatenOf', { done, all: N.meal_slots.length })}</span></div>
      <div className="slot-ticks">
        {N.meal_slots.map((slot) => {
          const on = eatenSlots.has(slot);
          return (
            <button key={slot} type="button" className={`slot-tick${on ? ' on' : ''}`} aria-pressed={on} aria-label={t('meals.eatenAria', { meal: slotLabel(slot) })}
              onClick={() => {
                const ev = mealTickEvent({ nowDone: !on, doneBefore: done, slots: N.meal_slots.length });
                update((d) => tickMeal(d, today, slot, null, !on));
                if (ev) feedback(ev);
                announce(mealTickLine({ meal: slotLabel(slot), eaten: !on, done: done + (on ? -1 : 1), total: N.meal_slots.length }));
              }}>
              <span className={`check${on ? ' on' : ''}`} aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
              <span>{slotLabel(slot)}</span>
            </button>
          );
        })}
      </div>

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

const dayLetter = (iso) => fromISO(iso).toLocaleDateString(LOCALE, { weekday: 'narrow' });

/** The last 7 days (DV-13 + BI-11): how much of each day was logged, and
 * protein at 90% of the target on logged days. No calorie dots: ticked
 * meals copy the plan, so they'd be on target by construction. Each day
 * opens that day. */
function MealWeek({ data, today, protein, date, onPick }) {
  const w = mealWeek(data, N.meal_slots, today, protein);
  return (
    <section className="card meal-week">
      <div className="row between"><strong>{t('mweek.title')}</strong><span className="muted small">{t('mweek.logged', { n: w.full })}</span></div>
      <div className="mweek-grid" role="list">
        {w.days.map((d) => (
          <button key={d.date} type="button" role="listitem" className={`mweek-day${d.date === date ? ' on' : ''}`} onClick={() => onPick(d.date)}
            aria-label={t('mweek.dayAria', { date: formatDate(d.date), logged: t(`mweek.l.${d.logged}`), protein: w.showProtein && d.hit != null ? t(d.hit ? 'mweek.p.hit' : 'mweek.p.short', { g: d.protein }) : '' })}>
            <span className="mweek-letter" aria-hidden="true">{dayLetter(d.date)}</span>
            <span className={`mdot log-${d.logged}`} aria-hidden="true" />
            {w.showProtein ? <span className={`mdot p-${d.hit == null ? 'none' : d.hit ? 'hit' : 'short'}`} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div className="chart-key" style={{ marginBottom: 0 }}>
        <span><i className="mdot log-full" aria-hidden="true" />{t('mweek.keyFull')}</span>
        <span><i className="mdot log-part" aria-hidden="true" />{t('mweek.keyPart')}</span>
        {w.showProtein ? <span><i className="mdot p-hit" aria-hidden="true" />{t('mweek.keyProtein')}</span> : null}
      </div>
      {w.showProtein && w.proteinDays ? <p className="small" style={{ margin: '6px 0 0' }}>{t('mweek.proteinLine', { hit: w.proteinHit, n: w.proteinDays })}</p> : null}
    </section>
  );
}

function MealPlan() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  // In Ramadan a late meal after midnight still belongs to last night.
  const opensOn = mealDay(data, today, clock());
  // Back from a library swap: open on the day that was swapped.
  const [params] = useSearchParams();
  const asked = params.get('date');
  // The day you were on comes back the same day (lib/viewMemory.js).
  const [date, setDate] = useViewState('date', opensOn, { day: today, prefer: /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : undefined });
  // Looking at today when midnight passes: follow the new day.
  const shownToday = useRef(opensOn);
  useEffect(() => {
    if (shownToday.current === opensOn) return;
    setDate((d) => (d === shownToday.current ? opensOn : d));
    shownToday.current = opensOn;
  }, [opensOn]);
  // Portions fitted to the person's kcal target (FIT-1); 'far' when the
  // plan can't be fitted, so it shows as written with a calm line.
  // Library swaps (lib/mealLibrary.js) are applied and fitted the same way.
  const { day, fit } = dayFor(date, data, N, today);
  const picks = Object.fromEntries(N.meal_slots.map((s) => [s, D.mealLog(data, date, s)?.option_key || null]));
  // Meals where something else was eaten count with their own numbers (UX-20).
  const custom = customMeals(data, date);
  const [otherFor, setOtherFor] = useState(null);
  const [recipe, setRecipe] = useState(null); // MOVE-2: { key, slot } shown in a quick-look sheet
  // Ticked meals keep the numbers they had when ticked (DA-1).
  const frozen = eatenMeals(data, date);
  const totals = dayTotals(day, picks, null, custom, frozen);
  const training = sessionKeyOn(date, activePlan(data, content), data.session_moves || []) !== 'rest';
  // The note is for before the session: gone once that day's workout is saved (UX-19).
  const trained = Boolean(D.workoutOn(data, date)?.finished_at);
  const target = macroTargets(data, N, today);
  const eatenSlots = new Set(N.meal_slots.filter((s) => D.mealLog(data, date, s)?.completed));
  const done = eatenSlots.size;
  const eaten = dayTotals(day, picks, eatenSlots, custom, frozen);
  // Ramadan: the same meals, at suhoor, iftar and after taraweeh.
  const fasting = ramadanActive(data, date);
  const rTimes = fasting ? effectiveTimes(data, content, date).meal_times : null;
  const label = (slot) => (fasting ? t(`ramadan.meal.${slot}`) : slotLabel(slot));

  const pct = (v, of) => (of ? Math.min(1, v / of) : 0);
  const itemMacros = (key) => N.foods[key] || null;
  const itemName = (key) => N.food_names?.[key] || key.replace(/_/g, ' ');

  return (
    <div className="page">
      <div className="plan-head">
        <h1 className="page-title">{t('tab.meals')}</h1>
        <div className="row" style={{ gap: 6 }}>
          <Link to="/meals/library" className="chip big-chip"><Icon name="book" className="icon" /> {t('lib.open')}</Link>
          <Link to="/shopping" className="chip big-chip"><Icon name="cart" className="icon" /> {t('meals.shopping')}</Link>
        </div>
      </div>
      <div className="row between card day-nav">
        <button type="button" className="icon-btn" aria-label={t('meals.prevDay')} onClick={() => setDate(addDays(date, -1))}><Icon name="back" /></button>
        <div style={{ textAlign: 'center' }} className="grow">
          <div className="session-name">{date === today ? t('meals.today') : formatDate(date)}{day.is_refeed ? ` · ${t('meals.refeed')}` : ''}</div>
          <div className="muted small">{day.label}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={t('meals.nextDay')} onClick={() => setDate(addDays(date, 1))}><Icon name="chev" /></button>
      </div>

      <div className="tile-grid">
        <div className="stat-tile macro">
          <div className="stat-tile-label">{t('meals.kcalEaten')}</div>
          <div className="macro-value"><CountUp value={eaten.kcal} /></div>
          <div className="stat-tile-label">/ {target.kcal} kcal</div>
          <div className={`progress ${fillTone(eaten.kcal, target.kcal)}`} style={{ marginTop: 10 }}><span style={{ transform: `scaleX(${pct(eaten.kcal, target.kcal)})` }} /></div>
        </div>
        <div className="stat-tile macro">
          <div className="stat-tile-label">{t('meals.proteinEaten')}</div>
          <div className="macro-value"><CountUp value={eaten.protein} /></div>
          <div className="stat-tile-label">/ {target.protein} g</div>
          <div className={`progress ${fillTone(eaten.protein, target.protein, { overAt: Infinity })}`} style={{ marginTop: 10 }}><span style={{ transform: `scaleX(${pct(eaten.protein, target.protein)})` }} /></div>
        </div>
      </div>
      <details className="macro-more">
        <summary>
          <span className="grow">{t('meals.carbsFat', { carbs: eaten.carbs, tc: target.carbs, fat: eaten.fat, tf: target.fat })}</span>
          <Icon name="chev" className="icon chev" />
        </summary>
        <div className="muted small" style={{ padding: '4px 0 8px' }}>
          {t('meals.summary', { carbs: eaten.carbs, tc: target.carbs, fat: eaten.fat, tf: target.fat, done, all: N.meal_slots.length, kcal: totals.kcal, protein: totals.protein })} <Link to="/profile">{target.source === 'profile' ? t('meals.yourTargets') : t('meals.setTargets')}</Link>
        </div>
      </details>
      <MealWeek data={data} today={today} protein={target.protein} date={date} onPick={setDate} />
      {target.reverse && !target.reverse.done && !kcalHidden(data) ? <p className="muted small" role="note">{t(target.reverse.heldLast ? 'maint.held' : 'maint.week', { week: target.reverse.week, weeks: target.reverse.weeks, kcal: target.kcal, next: formatDate(target.reverse.next_on) })}</p> : null}
      {target.adjust && !kcalHidden(data) ? (
        <div className="row muted small" role="note" style={{ gap: 8, margin: '0 0 12px' }}>
          <span className="grow">{t('tcheck.note', { kcal: Math.abs(target.adjust) })}</span>
          <button type="button" className="mini-btn" onClick={() => update(clearAdjustments)}>{t('tcheck.undo')}</button>
        </div>
      ) : null}
      {/* SAFE-2: what the safety check means for food, beside the meals. */}
      {gateOn(data, 'nursing_extra', today) && !kcalHidden(data) ? <p className="muted small safety-food" role="note">{t('safety.food.nursing')}</p> : null}
      {gateOn(data, 'protein_cap', today) ? <p className="muted small safety-food" role="note">{t('safety.food.kidney')}</p> : null}
      {gateOn(data, 'steady_carbs', today) ? <p className="muted small safety-food" role="note">{t('safety.food.diabetes')}</p> : null}
      {fit.state === 'far' ? <p className="muted small" role="note">{t(kcalHidden(data) ? 'meals.farPlanNoKcal' : 'meals.farPlan', { plan: fit.plan })}</p> : null}
      {(fit.state === 'far' ? [] : dayDrift(totals, target)).map((r) => (
        <div key={r.key} className="warn" role="note">
          {r.label} with these picks: {r.total} {r.unit}, {Math.round(Math.abs(r.diff) * 100)}% {r.over ? 'over' : 'under'} your {r.target} {r.unit} target.
          {day.is_refeed && r.key === 'kcal' && r.over ? ' It is a refeed day, so a little over is planned.' : r.key === 'protein' && !r.over ? ' Swap a meal for a higher-protein one from the library, or add a protein snack.' : ''}
        </div>
      ))}
      {fasting ? <div className="card small"><span className="chip accent">{t('ramadan.chip')}</span> <span className="muted">{t('ramadan.mealsNote')}</span></div>
        : training && !trained ? <p className="muted small train-line"><Icon name="bolt" className="icon" /> <strong>{t('meals.trainingDay')}</strong> {N.pre_workout_note}</p> : null}

      <div className="section-head"><h2 className="section-title">{t(date === today ? 'meals.todays' : 'meals.thisDay')}</h2><span className="muted small">{t('meals.eatenOf', { done, all: N.meal_slots.length })}</span></div>
      {day.meals.map((meal) => {
        const log = D.mealLog(data, date, meal.slot);
        const pick = picks[meal.slot];
        const opt = shownOption(meal, pick);
        const planMeal = meal.options[0];
        return (
          <section key={meal.slot} className={`card meal-card${log?.completed ? ' eaten' : ''}`}>
            <div className="row between">
              <div className="grow">
                <div className="session-name">{label(meal.slot)}</div>
                <div className="muted small">{fasting ? rTimes[meal.slot] : meal.time_window}</div>
              </div>
              <button type="button" className={`check${log?.completed ? ' on' : ''}`} aria-pressed={!!log?.completed} aria-label={t('meals.eatenAria', { meal: label(meal.slot) })}
                onClick={() => {
                  const ev = mealTickEvent({ nowDone: !log?.completed, doneBefore: done, slots: N.meal_slots.length });
                  update((d) => (log?.custom ? clearCustomMeal(d, date, meal.slot) : tickMeal(d, date, meal.slot, opt, !log?.completed)));
                  if (ev) feedback(ev);
                  announce(mealTickLine({ meal: label(meal.slot), eaten: !log?.completed, done: done + (log?.completed ? -1 : 1), total: N.meal_slots.length }));
                }}>
                {log?.completed ? <Icon name="check" /> : null}
              </button>
            </div>
            {log?.custom ? (
              <div className="ate-else">
                <div className="grow">
                  <div>{log.custom.name || t('other.unnamed')}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>{t('meals.kcalProtein', { kcal: log.custom.kcal, protein: log.custom.protein })}</div>
                </div>
                <button type="button" className="btn ghost small" onClick={() => setOtherFor(meal.slot)}>{t('other.change')}</button>
              </div>
            ) : (
              <>
              <div className="meal-pick">
                <MealThumb photo={opt.photo} blank={false} />
                <div className="grow">
                  <div className="meal-name">{opt.name || mealWhat(opt)}</div>
                  {opt.swapped ? <div className="muted small">{t('meals.planMeal', { name: planMeal.name || mealWhat(planMeal) })}</div> : null}
                </div>
                <Link to={`/meals/library?slot=${meal.slot}&date=${date}`} className="btn secondary small swap-btn"><Icon name="undo" /> {t('meals.swap')}</Link>
              </div>
              <details className="meal-more">
                <summary>
                  <div className="grow">
                    <div className="muted small">{t('meals.kcalProtein', { kcal: Math.round(opt.kcal), protein: Math.round(opt.protein) })}</div>
                  </div>
                  <Icon name="chev" className="icon chev" />
                </summary>
                <div className="meal-items">
                  {portionsOf(opt).map(([key, n]) => {
                    const m = itemMacros(key);
                    const nm = itemName(key);
                    return (
                      <div key={key} className="row between small">
                        <span className="grow">{nm.charAt(0).toUpperCase() + nm.slice(1)}{n !== 1 ? ` ×${n}` : ''}</span>
                        {m ? <span className="muted">{t('meals.itemMacros', { kcal: Math.round(m[0] * n), protein: Math.round(m[1] * n * 10) / 10 })}</span> : null}
                      </div>
                    );
                  })}
                  <div className="muted small" style={{ marginTop: 6 }}>{t('meals.fullMacros', { kcal: opt.kcal, protein: opt.protein, carbs: opt.carbs, fat: opt.fat })}</div>
                </div>
              </details>
                <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
                  {opt.key && N.library?.some((m) => m.key === opt.key) ? <button type="button" className="btn ghost small" onClick={() => setRecipe({ key: opt.key, slot: meal.slot })}><Icon name="book" /> {t('meals.recipe')}</button> : null}
                  {opt.swapped ? <button type="button" className="btn ghost small" onClick={() => update((d) => pickOption(d, date, meal.slot, planMeal))}><Icon name="back" /> {t('meals.backToPlan')}</button> : null}
                  <button type="button" className="btn ghost small ate-else-btn" onClick={() => setOtherFor(meal.slot)}><Icon name="plus" /> {t('other.open')}</button>
                </div>
              </>
            )}
            {log?.custom ? <button type="button" className="btn ghost small ate-else-btn" onClick={() => update((d) => clearCustomMeal(d, date, meal.slot))}>{t('other.back')}</button> : null}
          </section>
        );
      })}
      <SwitchView to="targets" />
      {otherFor ? <OtherFoodSheet data={data} update={update} date={date} slot={otherFor} mealName={label(otherFor)} entry={custom[otherFor]} onClose={() => setOtherFor(null)} /> : null}
      {recipe ? <RecipeSheet mealKey={recipe.key} slot={recipe.slot} date={date} onClose={() => setRecipe(null)} /> : null}
    </div>
  );
}
