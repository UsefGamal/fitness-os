import { useState } from 'react';

import * as D from '../lib/data.js';
import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { feedback } from '../store/feedback.js';
import Icon from './Icon.jsx';
import Sheet, { useCloseSheet } from './Sheet.jsx';
import Stepper from './Stepper.jsx';

// The same safe range as the Body form on Stats.
const MIN_KG = 20;
const MAX_KG = 400;

function Form({ data, update, today }) {
  const close = useCloseSheet();
  const latest = D.latestWeight(data);
  const [kg, setKg] = useState(latest?.weight_kg ?? data.goals?.at(-1)?.start_weight_kg ?? 70);
  const ok = kg >= MIN_KG && kg <= MAX_KG;
  const save = () => {
    if (!ok) return;
    update((d) => D.logBody(d, { log_date: today, weight_kg: kg }));
    feedback('meal');
    close();
  };
  return (
    <div className="stack">
      <Stepper label={t('weighIn.kg')} value={kg} onChange={setKg} step={0.1} min={0} max={MAX_KG} decimals={1} />
      {latest ? <div className="muted small">{t('stats.lastLog', { kg: latest.weight_kg, date: formatDate(latest.log_date) })}</div> : null}
      <button type="button" className="btn" disabled={!ok} onClick={save}><Icon name="check" /> {t('weighIn.save')}</button>
      <div className="muted small">{t('weighIn.note')}</div>
    </div>
  );
}

/** One-tap weigh-in from Home's weight card (UX-03): one number, Save.
 * Waist and the other measures stay on Stats > Body. */
export default function WeighInSheet({ data, update, today, onClose }) {
  return (
    <Sheet title={t('weighIn.title')} onClose={onClose}>
      <Form data={data} update={update} today={today} />
    </Sheet>
  );
}
