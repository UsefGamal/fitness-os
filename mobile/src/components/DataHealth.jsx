import Icon from './Icon.jsx';
import { dataHealth, readiness } from '../lib/dataHealth.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { content } from '../store/useData.js';

/** Settings > Data (BI-29): what keeps the numbers honest, as a plain
 * checklist with an icon for OK or worth a look. */
export function DataHealth({ data, today }) {
  const rows = dataHealth(data, activePlan(data, content), content.nutrition.meal_slots, today);
  return (
    <>
      <div className="section-label">{t('dh.title')}</div>
      <div className="list">
        {rows.map((r) => (
          <div key={r.key} className="list-row">
            <span className={`status-dot ${r.ok ? 'st-ready' : 'st-recovering'}`}><Icon name={r.ok ? 'check' : 'alert'} className="icon" /></span>
            <div className="grow">
              <div>{t(r.value == null ? `dh.${r.key}None` : `dh.${r.key}`, { n: r.value ?? 0, of: r.n })}</div>
              <div className="meta">{t(`dh.${r.key}.${r.ok ? 'ok' : r.value == null ? 'never' : 'fix'}`)}</div>
            </div>
            <span className="sr-only">{t(r.ok ? 'dh.okAria' : 'dh.fixAria')}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Stats > Overview (BI-01): when each insight starts, ticked off as it
 * unlocks. Shown until everything has. */
export function Readiness({ data, today }) {
  const items = readiness(data, activePlan(data, content), content.nutrition.meal_slots, today);
  const left = items.filter((i) => !i.done).length;
  if (!left) return null;
  return (
    <section className="card">
      <div className="row between"><strong>{t('ready.title')}</strong><span className="muted small">{t('ready.count', { done: items.length - left, n: items.length })}</span></div>
      <ul className="ready-list">
        {items.map((i) => (
          <li key={i.key} className={i.done ? 'done' : ''}>
            <Icon name={i.done ? 'check' : 'lock'} className="icon" />
            <div className="grow">
              <div>{t(`ready.${i.key}`)}</div>
              {i.done ? null : <div className="meta">{t(`ready.${i.key}.need`, { n: i.need })}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
