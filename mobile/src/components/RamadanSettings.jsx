// Settings > Times and reminders > Ramadan (E12-S1). Off by default. On,
// it suggests this year's dates, which the person checks and changes; the
// app never works the dates out itself.
import { formatDate } from '../lib/dates.js';
import { macroTargets } from '../lib/macros.js';
import { isTime } from '../lib/times.js';
import { t } from '../lib/i18n.js';
import { goalSlipDays, ramadanOf, ramadanSet, setRamadan, switchRamadan } from '../lib/ramadan.js';
import { content } from '../store/useData.js';
import Icon from './Icon.jsx';

export default function RamadanSettings({ data, update }) {
  const on = ramadanSet(data);
  const r = ramadanOf(data);
  const set = (changes) => { update((d) => setRamadan(d, changes)); };
  // The smaller deficit while fasting moves the goal date a little.
  const slip = on ? goalSlipDays(data, (iso) => macroTargets(data, content.nutrition, iso)) : null;
  return (
    <>
      <div className="section-label">{t('ramadan.title')}</div>
      <div className="list">
        <button type="button" className="list-row" aria-pressed={on} onClick={() => update((d) => switchRamadan(d, !on))}>
          <Icon name="sunrise" />
          <div className="grow"><div>{t('ramadan.mode')}</div><div className="meta">{on ? t('ramadan.onNote', { from: formatDate(r.from), to: formatDate(r.to) }) : t('ramadan.offNote')}</div></div>
          <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
        </button>
        {on ? (
          <>
            <label className="list-row">
              <div className="grow">{t('ramadan.from')}</div>
              <input type="date" style={{ width: 'auto' }} value={r.from} max={r.to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
            </label>
            <label className="list-row">
              <div className="grow">{t('ramadan.to')}</div>
              <input type="date" style={{ width: 'auto' }} value={r.to} min={r.from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
            </label>
            <label className="list-row">
              <div className="grow"><div>{t('ramadan.suhoor')}</div><div className="meta">{t('ramadan.suhoorNote')}</div></div>
              <input type="time" step="300" style={{ width: 'auto', minWidth: 112 }} value={r.suhoor} onChange={(e) => isTime(e.target.value) && set({ suhoor: e.target.value })} />
            </label>
            <label className="list-row">
              <div className="grow"><div>{t('ramadan.iftar')}</div><div className="meta">{t('ramadan.iftarNote')}</div></div>
              <input type="time" step="300" style={{ width: 'auto', minWidth: 112 }} value={r.iftar} onChange={(e) => isTime(e.target.value) && set({ iftar: e.target.value })} />
            </label>
          </>
        ) : null}
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>{t('ramadan.explain')}</p>
      {slip ? <p className="muted small" role="note" style={{ margin: '-4px 16px 12px' }}>{t(slip === 1 ? 'ramadan.slipOne' : 'ramadan.slip', { n: slip })}</p> : null}
    </>
  );
}
