import { Link } from 'react-router';

import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { currentGoal } from '../lib/macros.js';
import { goalProgress } from '../lib/progress.js';
import Icon from './Icon.jsx';

const GOOD = new Set(['steady', 'reached']);

/** Home's goal card (E10-S1): trend weight, pace against the safe band and
 * a reach-date range beside the goal date. Never says "behind". */
export default function GoalCard({ data, today }) {
  const goal = currentGoal(data);
  const p = goalProgress(data.body_logs, goal, today);
  if (!p) {
    return (
      <Link to="/stats" className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="row between"><strong>{t('goal.title')}</strong><Icon name="chev" className="icon" /></div>
        <div className="muted small" style={{ marginTop: 6 }}>{t('goal.noWeighIn')}</div>
      </Link>
    );
  }
  return (
    <Link to="/stats" className="card" style={{ display: 'block', color: 'inherit' }} aria-label={t('goal.aria', { trend: p.trend })}>
      <div className="row between" style={{ gap: 8 }}>
        <strong>{t('goal.title')}</strong>
        <span className={`chip${GOOD.has(p.status) ? ' accent' : ''}`}>{t(`goal.status.${p.status}`)}</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 6, margin: '6px 0 2px' }}>
        <span style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.trend}</span>
        <span className="muted">{t('goal.trendUnit')}</span>
      </div>
      <div className="muted small">{t('goal.latest', { kg: p.latest, date: formatDate(p.latest_date) })}</div>
      {p.target != null ? (
        <>
          <div className="progress" style={{ margin: '10px 0 6px' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((p.share_done ?? 0) * 100)}>
            <span style={{ width: `${Math.round((p.share_done ?? 0) * 100)}%` }} />
          </div>
          <div className="small">{t(p.mode === 'gain' ? 'goal.soFarGain' : 'goal.soFar', { done: Math.max(0, p.done_kg), left: p.left_kg, target: p.target })}</div>
        </>
      ) : null}
      {p.pace != null ? (
        <div className="small" style={{ marginTop: 6 }}>{t(`goal.pace.${p.mode}`, { pace: Math.abs(p.pace), pct: Math.abs(p.pct), lo: p.band[0], hi: p.band[1] })}</div>
      ) : null}
      {p.range ? (
        <div className="small" style={{ marginTop: 6 }}>
          {t('goal.range', { target: p.target, from: formatDate(p.range[0]), to: formatDate(p.range[1]) })}
          {p.vs_goal ? ` ${t(`goal.vs.${p.vs_goal}`, { date: formatDate(p.goal_date) })}` : ''}
        </div>
      ) : null}
      <div className="muted small" style={{ marginTop: 6 }}>{t(`goal.next.${p.status}`, { n: p.logs_needed })}</div>
    </Link>
  );
}
