import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { t } from '../lib/i18n.js';
import { isChangedOn, sessionKeyOn, setSessionOn, undoMove } from '../lib/schedule.js';

/** Pick what to do on one date: any session of the plan, or rest. Only
 * that date changes; the weekly plan stays as it is. */
export default function DayPicker({ date, dayName, training, data, update, onClose }) {
  const moves = data.session_moves || [];
  const current = sessionKeyOn(date, training, moves);
  const changed = isChangedOn(date, moves);
  const pick = (key) => {
    update((d) => setSessionOn(d, training, date, key));
    onClose();
  };
  const options = [...training.program.map((p) => ({ key: p.key, label: p.label, focus: p.focus })), { key: 'rest', label: t('week.rest'), focus: t('week.restNote') }];
  return (
    <Sheet title={t('week.pickTitle', { day: dayName })} onClose={onClose}>
      <p className="muted small" style={{ margin: '0 4px 10px' }}>{t('week.pickNote')}</p>
      <div className="list">
        {options.map((o) => (
          <button key={o.key} type="button" className="list-row" aria-pressed={o.key === current} onClick={() => pick(o.key)}>
            <div className="grow">
              <div>{o.label}</div>
              {o.focus ? <div className="meta small">{o.focus}</div> : null}
            </div>
            {o.key === current ? <Icon name="check" /> : null}
          </button>
        ))}
      </div>
      {changed ? (
        <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => { update((d) => undoMove(d, date)); onClose(); }}>{t('week.backToPlan')}</button>
      ) : null}
    </Sheet>
  );
}
