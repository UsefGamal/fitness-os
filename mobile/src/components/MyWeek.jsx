import { useState } from 'react';

import { t } from '../lib/i18n.js';
import { activeBlock, isWeekEdited, resetWeek, setWeekday, WEEKDAYS } from '../lib/plan.js';

/** Choose which session goes on each weekday, every week. */
export default function MyWeek({ data, update, content, training, open = false }) {
  const [refused, setRefused] = useState(false);
  if (!activeBlock(data)) return null;
  const schedule = training.trainer_plan.schedule;
  const sessionOf = (day) => schedule.find((e) => e.day === day)?.session ?? 'rest';
  const trainingDays = WEEKDAYS.filter((d) => sessionOf(d) !== 'rest').length;
  const set = (day, session) => {
    if (session === 'rest' && sessionOf(day) !== 'rest' && trainingDays === 1) { setRefused(true); return; }
    setRefused(false);
    update((d) => setWeekday(d, content, day, session));
  };
  // Start the list on the person's week start.
  const order = data.profile?.week_start === 'mon' ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;
  return (
    <details className="card more" open={open || undefined}>
      <summary>{t('week.myWeek')}</summary>
      <p className="muted small" style={{ margin: '8px 0' }}>{t('week.myWeekNote')}</p>
      <div className="stack" style={{ gap: 8 }}>
        {order.map((day) => (
          <label key={day} className="field" style={{ margin: 0 }}>
            <span>{t(`day.${day}`)}</span>
            <select value={sessionOf(day)} onChange={(e) => set(day, e.target.value)}>
              {training.program.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              <option value="rest">{t('week.rest')}</option>
            </select>
          </label>
        ))}
      </div>
      {refused ? <p className="small" role="alert" style={{ margin: '8px 0 0', color: 'var(--warn)' }}>{t('week.needOneDay')}</p> : null}
      {isWeekEdited(data, content) ? (
        <button type="button" className="btn ghost small" style={{ marginTop: 10 }} onClick={() => update((d) => resetWeek(d, content))}>{t('week.reset')}</button>
      ) : null}
    </details>
  );
}
