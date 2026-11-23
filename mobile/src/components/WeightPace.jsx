import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { arrivalWindow, paceRange } from '../lib/pace.js';
import { adviceKey, statusGood } from '../lib/progress.js';
import Icon from './Icon.jsx';

/** The weight pace in words (moved from Home's weight card to Stats > Body
 * in the Home simplify): the measured weekly range, when the goal could
 * arrive and the one next step. Never says "behind". */
export default function WeightPace({ data, goal, p, today }) {
  const pr = paceRange(data.body_logs, goal, today);
  const status = p.status === 'reached' ? 'reached' : pr.ready ? pr.status : 'early';
  const arrive = pr.ready && p.target != null && p.mode !== 'maintain' && status !== 'reached' ? arrivalWindow(p.trend, p.target, pr, today) : null;
  const short = (d) => formatDate(d).replace(/^\S+\s/, ''); // "12 Mar", not "Thu 12 Mar"
  return (
    <div className="weight-pace">
      {pr.ready && status !== 'reached' ? (
        <div className="pace-range">
          <span>{t(`pace.range${p.mode[0].toUpperCase()}${p.mode.slice(1)}`, { range: t('pace.range', { low: Math.max(0, pr.low), high: pr.high }) })}</span>
          {statusGood(p.mode, status) ? <span className="chip accent"><Icon name="check" className="icon" /> {t('pace.inBand')}</span> : null}
          <span className="muted small pace-n">{t('pace.from', { n: pr.n })}</span>
        </div>
      ) : null}
      {arrive?.early ? <div className="small pace-arrive">{t(p.goal_date ? 'pace.arriveGoal' : 'pace.arrive', { target: p.target, early: short(arrive.early), late: short(arrive.late), goal: p.goal_date ? short(p.goal_date) : '' })}</div> : null}
      {arrive?.tooEarly ? <div className="muted small pace-arrive">{t('pace.tooEarly')}</div> : null}
      {pr.reason === 'water' && status === 'early' ? <div className="muted small" style={{ marginTop: 4 }}>{t('pace.water')}</div> : (
        <div className="muted small" style={{ marginTop: 4 }}><strong className={statusGood(p.mode, status) ? 'pace good' : 'pace'}>{t(`goal.status.${status}`)}.</strong> {t(adviceKey(p.mode, status), { n: pr.need || 1 })}</div>
      )}
    </div>
  );
}
