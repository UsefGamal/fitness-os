import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

/** The weekly target check (TARGET-1): one card, two choices, nothing
 * changes until the person picks Lower. */
export default function TargetCheckCard({ step, kcal, onLower, onKeep }) {
  return (
    <section className="card" role="status" aria-labelledby="target-check-title">
      <div className="row" style={{ gap: 10 }}>
        <span className="session-icon small" style={{ flex: 'none' }} aria-hidden="true"><Icon name="trend" /></span>
        <strong id="target-check-title">{t('tcheck.title')}</strong>
      </div>
      <p className="muted small" style={{ margin: '8px 0 12px' }}>{t('tcheck.body', { step, kcal: kcal - step })}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="btn" onClick={onLower}>{t('tcheck.lower', { step })}</button>
        <button type="button" className="btn ghost" onClick={onKeep}>{t('tcheck.keep')}</button>
      </div>
    </section>
  );
}
