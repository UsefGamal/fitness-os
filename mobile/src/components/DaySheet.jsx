import { useNavigate } from 'react-router';

import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { longWeekday } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import * as P from '../lib/planEdit.js';

/** Home's "This week" tap: one day's session and its exercises in a sheet,
 * with the next step (start, do it today, see the log, or open in Plan). */
export default function DaySheet({ day: d, data, training, today, time, log, onClose }) {
  const navigate = useNavigate();
  const go = (to) => { onClose(); navigate(to); };
  const session = d.key === 'rest' ? null : P.effectiveDay(d.key, training, data);
  const title = session ? session.label : t('week.rest');
  return (
    <Sheet title={title} onClose={onClose}>
      {session ? (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 4px 8px' }}>
            <span className="muted small">{longWeekday(d.date)}</span>
            {log ? <span className="chip accent"><Icon name="check" className="icon" /> {t('daySheet.done')}</span> : null}
            {d.isToday && !log ? <span className="chip">{t('daySheet.today', { time })}</span> : null}
            {session.edited ? <span className="chip">{t('daySheet.edited')}</span> : null}
          </div>
          {session.focus ? <p className="muted small" style={{ margin: '0 4px 10px' }}>{session.focus}</p> : null}
          <div className="list">
            {session.exercises.map((ex, i) => (
              <div key={`${ex.name}-${i}`} className="list-row" style={{ minHeight: 44 }}>
                <div className="grow">
                  <div>{ex.pair ? <span className="pair">{ex.pair}</span> : null}{ex.name}</div>
                  <div className="meta">{ex.sets} × {ex.reps}{ex.rest ? ` · ${t('daySheet.rest', { rest: ex.rest })}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="stack" style={{ marginTop: 12, gap: 8 }}>
            {log ? (
              <button type="button" className="btn secondary" onClick={() => go(`/history/${log.id}`)}>{t('daySheet.seeLog')}</button>
            ) : d.isToday ? (
              <button type="button" className="btn" onClick={() => go('/workout')}><Icon name="play" /> {t('daySheet.start', { name: session.label })}</button>
            ) : today < d.date ? (
              <button type="button" className="btn secondary" onClick={() => go(`/workout?session=${session.key}`)}><Icon name="play" /> {t('daySheet.doToday')}</button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => go(`/plan?day=${d.date}`)}>{t('daySheet.openPlan')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: '0 4px 12px' }}>{longWeekday(d.date)}. {t('week.restNote')}</p>
          <button type="button" className="btn ghost" onClick={() => go(`/plan?day=${d.date}`)}>{t('daySheet.openPlan')}</button>
        </>
      )}
    </Sheet>
  );
}
