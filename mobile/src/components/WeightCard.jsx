import { Link } from 'react-router';

import { formatDate } from '../lib/dates.js';
import { trendChange, sparkPath } from '../lib/home.js';
import { t } from '../lib/i18n.js';
import { strengthMove } from '../lib/insights.js';
import { currentGoal } from '../lib/macros.js';
import { arrivalWindow, paceRange } from '../lib/pace.js';
import { adviceKey, changeGood, goalProgress, statusGood } from '../lib/progress.js';
import Icon from './Icon.jsx';
import RollNumber from './RollNumber.jsx';

const W = 132;
const H = 56;

/** Home's weight hero (redesign of the E10-S1 goal card): the latest
 * weigh-in big (Yusuf's ask, 19 Nov), the smoothed trend under it, how the
 * trend moved in two weeks, a small line and the one next step.
 * Pace and reach dates stay one tap away on Stats. Never says "behind". */
export default function WeightCard({ data, today, onLog }) {
  const goal = currentGoal(data);
  const p = goalProgress(data.body_logs, goal, today);
  if (!p) {
    // Nothing logged yet: the card is the button that logs the first one (UX-03).
    return (
      <section className="card hero-card">
        <span className="hero-label"><Icon name="trend" /> {t('home.weightTitle')}</span>
        <div className="muted small" style={{ margin: '8px 0 12px' }}>{t('goal.noWeighIn')}</div>
        <button type="button" className="btn secondary" onClick={onLog}><Icon name="plus" /> {t('home.weightFirst')}</button>
      </section>
    );
  }
  // Pace as a measured range (charts step 2): the status word and advice
  // follow it, so the card never says "good pace" beside a range that isn't.
  const pr = paceRange(data.body_logs, goal, today);
  const status = p.status === 'reached' ? 'reached' : pr.ready ? pr.status : 'early';
  const arrive = pr.ready && p.target != null && p.mode !== 'maintain' && status !== 'reached' ? arrivalWindow(p.trend, p.target, pr, today) : null;
  const short = (d) => formatDate(d).replace(/^\S+\s/, ''); // "12 Mar", not "Thu 12 Mar"
  const change = trendChange(p.series);
  const spark = sparkPath(p.series, { w: W, h: H, pad: 6 });
  // Gaining and muscle-building are judged by the bar, not the scale: one
  // line on the lift that moved most, under the weight.
  const lifting = p.mode === 'gain' || p.mode === 'recomp';
  const move = lifting ? strengthMove(data, today) : null;
  const strengthText = !move ? t('home.strengthNone')
    : move.kg > 0 ? t('home.strengthUp', { name: move.name, kg: move.kg, days: move.days })
      : t('home.strengthHold', { name: move.name, kg: move.now });
  return (
    <section className={`card hero-card${statusGood(p.mode, status) ? '' : ' neutral'}`} data-tour="weight">
      <Link to="/stats?tab=body" className="hero-link">
      <span className="sr-only">{t('home.weightOpen')}</span>
      <div className="hero-top">
        <div className="grow">
          <span className="hero-label"><Icon name="trend" /> {t('home.weightToday')}</span>
          <div className="hero-value"><span className="num"><RollNumber value={p.latest} /></span><span className="unit">{t('home.kg')}</span></div>
        </div>
        {spark ? (
          <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
            <defs><linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
            <path d={`${spark.d} L${spark.end[0]},${H} L6,${H} Z`} fill="url(#spark-fill)" />
            <path d={spark.d} fill="none" stroke="var(--accent-stroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={spark.end[0]} cy={spark.end[1]} r="4" fill="var(--accent-stroke)" />
          </svg>
        ) : null}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {change ? (
          <span className={`chip${changeGood(p.mode, change.kg) ? ' accent' : ''}`}>
            {change.kg < 0 ? '↓' : change.kg > 0 ? '↑' : '→'} {t('home.changeKg', { kg: Math.abs(change.kg) })}
          </span>
        ) : null}
        {change ? <span className="muted small">{t('home.changeNote', { days: change.days })}</span> : null}
      </div>
      {p.target != null ? (
        <>
          <div className="progress" style={{ margin: '14px 0 6px' }} role="progressbar" aria-label={t('goal.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((p.share_done ?? 0) * 100)}>
            <span style={{ transform: `scaleX(${(Math.round((p.share_done ?? 0) * 100)) / 100})` }} />
          </div>
          <div className="small">{t(p.mode === 'gain' ? 'goal.soFarGain' : 'goal.soFar', { done: Math.max(0, p.done_kg), left: p.left_kg, target: p.target })}</div>
        </>
      ) : null}
      {pr.ready && status !== 'reached' ? (
        <div className="pace-range">
          <span>{t(`pace.range${p.mode[0].toUpperCase()}${p.mode.slice(1)}`, { range: t('pace.range', { low: Math.max(0, pr.low), high: pr.high }) })}</span>
          {statusGood(p.mode, status) ? <span className="chip accent"><Icon name="check" className="icon" /> {t('pace.inBand')}</span> : null}
          <span className="muted small pace-n">{t('pace.from', { n: pr.n })}</span>
        </div>
      ) : null}
      {arrive?.early ? <div className="small pace-arrive">{t(p.goal_date ? 'pace.arriveGoal' : 'pace.arrive', { target: p.target, early: short(arrive.early), late: short(arrive.late), goal: p.goal_date ? short(p.goal_date) : '' })}</div> : null}
      {arrive?.tooEarly ? <div className="muted small pace-arrive">{t('pace.tooEarly')}</div> : null}
      {/* The pace is the advice's lead-in, not a second badge beside the change (rule 1). */}
      {pr.reason === 'water' && status === 'early' ? <div className="muted small" style={{ marginTop: 4 }}>{t('pace.water')}</div> : (
        <div className="muted small" style={{ marginTop: 4 }}><strong className={statusGood(p.mode, status) ? 'pace good' : 'pace'}>{t(`goal.status.${status}`)}.</strong> {t(adviceKey(p.mode, status), { n: pr.need || 1 })}</div>
      )}
      </Link>
      {lifting ? (
        <Link to="/stats?tab=strength" className={`strength-line${move?.kg > 0 ? ' up' : ''}`} aria-label={`${strengthText}. ${t('home.strengthAria')}`}>
          <Icon name="barbell" className="icon" /><span className="grow">{strengthText}</span><Icon name="chev" className="icon chev" />
        </Link>
      ) : null}
      <div className="row between" style={{ gap: 8, marginTop: 8 }}>
        <span className="muted small">{t('home.weightTrendLine', { kg: p.trend, date: formatDate(p.latest_date) })}</span>
        <button type="button" className="mini-btn hero-log" onClick={onLog}><Icon name="plus" className="icon" /> {t('home.weightLog')}</button>
      </div>
    </section>
  );
}
