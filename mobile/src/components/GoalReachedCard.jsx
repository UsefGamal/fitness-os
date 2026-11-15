import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import { reversePlan } from '../lib/maintenance.js';

/** The goal is reached (MAINT-1): one card on Home offers maintenance, with
 * calories that climb in weekly steps. Numbers only when calories show. */
export default function GoalReachedCard({ targets, showKcal, onStart, onLater }) {
  const plan = targets?.tdee ? reversePlan(targets.kcal, targets.tdee) : { weeks: 0 };
  const body = !showKcal || !plan.weeks
    ? t('maint.bodyPlain')
    : t('maint.body', { step: plan.step, weeks: plan.weeks, tdee: targets.tdee });
  return (
    <section className="card goal-card" role="status">
      <div className="row between">
        <div className="row grow" style={{ gap: 10, minWidth: 0 }}>
          <span className="session-icon small" style={{ flex: 'none' }} aria-hidden="true"><Icon name="trophy" /></span>
          <strong>{t('maint.title')}</strong>
        </div>
        <button type="button" className="icon-btn" style={{ flex: 'none' }} aria-label={t('maint.later')} onClick={onLater}><Icon name="x" /></button>
      </div>
      <p className="muted small" style={{ margin: '8px 0 12px' }}>{body}</p>
      <button type="button" className="btn" onClick={onStart}><Icon name="check" /> {t('maint.start')}</button>
    </section>
  );
}
