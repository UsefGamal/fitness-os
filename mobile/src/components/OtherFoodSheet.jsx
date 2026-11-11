import { useState } from 'react';

import { t } from '../lib/i18n.js';
import { cleanFood, forgetFood, logCustomMeal, MAX_FOOD_NAME, MAX_KCAL, MAX_PROTEIN, myFoods } from '../lib/myFoods.js';
import { feedback } from '../store/feedback.js';
import Icon from './Icon.jsx';
import Sheet, { useCloseSheet } from './Sheet.jsx';
import Stepper from './Stepper.jsx';

function Form({ data, update, date, slot, entry }) {
  const close = useCloseSheet();
  const [name, setName] = useState(entry?.name ?? '');
  const [kcal, setKcal] = useState(entry?.kcal ?? 400);
  const [protein, setProtein] = useState(entry?.protein ?? 20);
  const food = cleanFood({ name, kcal, protein });
  const saved = myFoods(data);
  const log = (f) => {
    update((d) => logCustomMeal(d, date, slot, f));
    feedback('meal');
    close();
  };
  return (
    <div className="stack">
      {saved.length ? (
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>{t('other.mine')}</div>
          <div className="list">
            {saved.map((f) => (
              <div key={f.name} className="list-row my-food">
                <button type="button" className="grow my-food-pick" onClick={() => log(f)}>
                  <div>{f.name}</div>
                  <div className="meta small">{t('meals.kcalProtein', { kcal: f.kcal, protein: f.protein })}</div>
                </button>
                <button type="button" className="icon-btn" aria-label={t('other.forget', { name: f.name })} onClick={() => update((d) => forgetFood(d, f.name))}><Icon name="x" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <label className="field">
        <span>{t('other.name')}</span>
        <input type="text" value={name} maxLength={MAX_FOOD_NAME} placeholder={t('other.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>
      <Stepper label={t('other.kcal')} value={kcal} onChange={setKcal} step={50} min={0} max={MAX_KCAL} />
      <Stepper label={t('other.protein')} value={protein} onChange={setProtein} step={5} min={0} max={MAX_PROTEIN} />
      {food ? null : <div className="muted small" role="alert">{t('other.check')}</div>}
      <button type="button" className="btn" disabled={!food} onClick={() => log(food)}><Icon name="check" /> {t('other.save')}</button>
      <div className="muted small">{t('other.note')}</div>
    </div>
  );
}

/** "I ate something else" for one meal (UX-20): a saved food in one tap,
 * or a name with calories and protein. It counts as eaten. */
export default function OtherFoodSheet({ data, update, date, slot, mealName, entry, onClose }) {
  return (
    <Sheet title={t('other.title', { meal: mealName })} onClose={onClose}>
      <Form data={data} update={update} date={date} slot={slot} entry={entry} />
    </Sheet>
  );
}
