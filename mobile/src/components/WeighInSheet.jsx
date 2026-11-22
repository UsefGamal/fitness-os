import { useState } from 'react';

import { MEASURES } from '../lib/bodyStats.js';
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
const lastOf = (logs, k) => [...logs].reverse().find((b) => b[k] != null)?.[k] ?? null;

function Form({ data, update, today, entry, measures }) {
  const close = useCloseSheet();
  const latest = D.latestWeight(data);
  const [kg, setKg] = useState(entry?.weight_kg ?? latest?.weight_kg ?? data.goals?.at(-1)?.start_weight_kg ?? 70);
  const [cm, setCm] = useState({});
  const [more, setMore] = useState(false);
  const ok = kg >= MIN_KG && kg <= MAX_KG;
  const save = () => {
    if (!ok) return;
    const extra = {};
    for (const k of MEASURES) {
      const v = parseFloat(cm[k]);
      if (v >= 10 && v <= 300) extra[k] = v;
    }
    update((d) => D.logBody(d, { log_date: entry ? entry.log_date : today, weight_kg: kg, ...extra }));
    feedback('meal');
    close();
  };
  const remove = () => {
    update((d) => D.deleteBody(d, entry.id));
    close();
  };
  return (
    <div className="stack">
      <Stepper label={t('weighIn.kg')} value={kg} onChange={setKg} step={0.1} min={0} max={MAX_KG} decimals={1} />
      {latest && !entry ? <div className="muted small">{t('stats.lastLog', { kg: latest.weight_kg, date: formatDate(latest.log_date) })}</div> : null}
      {measures ? (
        <>
          <div className="measure-grid">
            {(more ? MEASURES : MEASURES.slice(0, 1)).map((k) => {
              const last = lastOf(data.body_logs, k);
              return (
                <label key={k} className="field"><span>{t(`body.m.${k}`)}</span>
                  <input type="number" inputMode="decimal" step="0.5" value={cm[k] || ''} onChange={(e) => setCm((c) => ({ ...c, [k]: e.target.value }))} placeholder={last != null ? String(last) : t('body.optional')} />
                </label>
              );
            })}
          </div>
          {more ? null : <button type="button" className="btn ghost small" onClick={() => setMore(true)}><Icon name="plus" /> {t('body.moreMeasures')}</button>}
        </>
      ) : null}
      <button type="button" className="btn" disabled={!ok} onClick={save}><Icon name="check" /> {t('weighIn.save')}</button>
      {entry ? <button type="button" className="btn ghost" style={{ color: 'var(--danger)' }} onClick={remove}><Icon name="trash" /> {t('weighIn.delete')}</button> : <div className="muted small">{t('weighIn.note')}</div>}
    </div>
  );
}

/** One-tap weigh-in from Home's weight card (UX-03): one number, Save.
 * With `measures` (Stats > Body) it also takes waist and, on a tap, chest,
 * arm, hips and thigh. With `entry` (a row of body_logs) it edits that
 * day's weight instead, with Delete inside (UX-23). */
export default function WeighInSheet({ data, update, today, onClose, entry = null, measures = false }) {
  return (
    <Sheet title={entry ? t('weighIn.editTitle', { date: formatDate(entry.log_date) }) : t('weighIn.title')} onClose={onClose}>
      <Form data={data} update={update} today={today} entry={entry} measures={measures && !entry} />
    </Sheet>
  );
}
