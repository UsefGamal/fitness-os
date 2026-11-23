import { Link } from 'react-router';

import { formatDate } from '../lib/dates.js';
import { trendChange, sparkPath } from '../lib/home.js';
import { t } from '../lib/i18n.js';
import { currentGoal } from '../lib/macros.js';
import { paceRange } from '../lib/pace.js';
import { adviceKey, changeGood, goalProgress } from '../lib/progress.js';
import Icon from './Icon.jsx';
import RollNumber from './RollNumber.jsx';

const W = 120;
const H = 48;

/** Home's weight summary (Home simplify, Nov 2026): four things only, the
 * latest weigh-in, how the trend moved, the goal left and Log weight. The
 * pace, the reach dates and the history are one tap away on Stats > Body. */
export default function WeightCard({ data, today, onLog }) {
  const goal = currentGoal(data);
  const p = goalProgress(data.body_logs, goal, today);
  if (!p) {
    // Nothing logged yet: the card is the button that logs the first one (UX-03).
    return (
      <section className="card hero-card">
        <h2 className="card-title">{t('home.weightTitle')}</h2>
        <div className="muted small" style={{ margin: '8px 0 12px' }}>{t('goal.noWeighIn')}</div>
        <button type="button" className="btn secondary" onClick={onLog}><Icon name="plus" /> {t('home.weightFirst')}</button>
      </section>
    );
  }
  const pr = paceRange(data.body_logs, goal, today);
  const status = p.status === 'reached' ? 'reached' : pr.ready ? pr.status : 'early';
  const change = trendChange(p.series);
  const spark = sparkPath(p.series, { w: W, h: H, pad: 6 });
  const good = change && changeGood(p.mode, change.kg, status);
  const leftText = status === 'reached' ? t('body.inGoal') : p.mode !== 'maintain' ? t('body.toGo', { kg: p.left_kg }) : null;
  const share = Math.round((p.share_done ?? 0) * 100);
  return (
    <section className="card hero-card" data-tour="weight">
      <div className="card-head">
        <h2 className="card-title">{t('home.weightTitle')}</h2>
        <Link to="/stats?tab=body" className="see-all">{t('home.weightProgress')} <Icon name="chev" className="icon" /></Link>
      </div>
      <div className="hero-top">
        <div className="grow">
          <div className="hero-value"><span className="num"><RollNumber value={p.latest} /></span><span className="unit">{t('home.kg')}</span></div>
          {change ? (
            <div className={`hero-change${good ? ' good' : ''}`}>
              {change.kg < 0 ? '↓' : change.kg > 0 ? '↑' : '→'} {t('home.changeSince', { kg: Math.abs(change.kg), days: change.days })}
            </div>
          ) : null}
        </div>
        {spark ? (
          <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
            <path d={spark.d} fill="none" stroke="var(--accent-stroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={spark.end[0]} cy={spark.end[1]} r="3.5" fill="var(--accent-stroke)" />
          </svg>
        ) : null}
      </div>
      {/* The weigh-in habit stays on Home: how many more weigh-ins until the
          pace shows (with the water note when a jump is likely water), then
          the last weigh-in date. Never "behind". */}
      <div className="muted small hero-note">{pr.reason === 'water' && status === 'early' ? t('pace.water') : status === 'early' ? t(adviceKey(p.mode, 'early'), { n: pr.need || 1 }) : t('home.lastWeighed', { date: formatDate(p.latest_date) })}</div>
      {p.target != null && p.mode !== 'maintain' ? (
        <>
          <div className="progress" style={{ margin: '16px 0 8px' }} role="progressbar" aria-label={t('goal.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}>
            <span style={{ transform: `scaleX(${share / 100})` }} />
          </div>
          <div className="row between small">
            <span className="muted">{t('home.goalKg', { kg: p.target })}</span>
            {leftText ? <span className="muted">{leftText}</span> : null}
          </div>
        </>
      ) : null}
      <button type="button" className="btn outline hero-log" onClick={onLog}><Icon name="plus" /> {t('home.weightLog')}</button>
    </section>
  );
}
