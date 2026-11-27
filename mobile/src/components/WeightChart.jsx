
import { dateTicks, weightFrame } from '../lib/bodyStats.js';
import { dateScale } from '../lib/chartScale.js';
import { formatDate, fromISO, LOCALE } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import useViewState from './useViewState.js';

const RANGE_KEYS = ['m1', 'm3', 'all'];
const W = 340;
const H = 184;
const L = 34; // room for the kg labels
const R = 8;
const T = 10;
const B = 22; // room for the date labels

const tickLabel = (tk) => fromISO(tk.date).toLocaleDateString(LOCALE, tk.kind === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' });

/**
 * Stats > Body weight chart (charts step 4, C-1): the trend as the line,
 * each weigh-in as a faint dot, kg gridlines, dates by month or week, a
 * 4 weeks / 3 months / All switch, and a table for screen readers or
 * anyone who'd rather read numbers.
 */
export default function WeightChart({ logs, today, goalLow, goalHigh }) {
  const [range, setRange] = useViewState('wchart-range', 'm3');
  const [table, setTable] = useViewState('wchart-table', false);
  const goal = goalLow && goalHigh ? { low: goalLow, high: goalHigh } : null;
  const f = weightFrame(logs, today, range, goal);
  const pts = f.points;

  const seg = (
    <div className="seg chart-range" role="group" aria-label={t('wchart.range')}>
      {RANGE_KEYS.map((k) => (
        <button key={k} type="button" className={range === k ? 'on' : ''} aria-pressed={range === k} onClick={() => setRange(k)}>{t(`wchart.${k}`)}</button>
      ))}
    </div>
  );
  if (pts.length < 2) return <>{seg}<div className="empty small">{t('wchart.empty')}</div></>;

  const first = pts[0].date;
  const last = pts[pts.length - 1].date;
  // The axis runs to today, so a week without weigh-ins shows as a gap.
  const end = last < today ? today : last;
  const at = dateScale([first, end], L, W - R);
  const y = (v) => T + ((f.hi - v) / (f.hi - f.lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${at(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const now = pts[pts.length - 1];
  const ticks = dateTicks(first, end).filter((tk) => at(tk.date) > L + 12 || tk.date === first);
  const band = f.goal === 'in' ? [Math.min(goalHigh, f.hi), Math.max(goalLow, f.lo)] : null;

  return (
    <>
      {seg}
      <svg className="chart weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('aria.weightChart', { from: pts[0].trend, to: now.trend })}>
        {band ? <rect x={L} width={W - L - R} y={y(band[0])} height={Math.max(1, y(band[1]) - y(band[0]))} fill="var(--accent-dim)" /> : null}
        {f.ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--surface3)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--chart-label)">{v}</text>
          </g>
        ))}
        {ticks.map((tk) => (
          <text key={tk.date} x={at(tk.date)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--chart-label)">{tickLabel(tk)}</text>
        ))}
        {pts.map((p) => <circle key={p.date} cx={at(p.date)} cy={y(p.weight)} r="2.2" fill="var(--muted)" opacity="0.55" />)}
        <path d={line} fill="none" stroke="var(--accent-stroke)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={at(now.date)} cy={y(now.trend)} r="4.5" fill="var(--accent-stroke)" stroke="var(--surface)" strokeWidth="2" />
      </svg>
      <div className="chart-key">
        <span><i className="key-line" aria-hidden="true" />{t('wchart.trend')}</span>
        <span><i className="key-dot" aria-hidden="true" />{t('wchart.weighIn')}</span>
        {band ? <span><i className="key-band" aria-hidden="true" />{t('wchart.goal')}</span> : null}
        {f.goal === 'below' || f.goal === 'above' ? <span className="muted">{t(f.goal === 'below' ? 'wchart.goalBelow' : 'wchart.goalAbove', { low: goalLow, high: goalHigh })}</span> : null}
      </div>
      <button type="button" className="btn ghost small" aria-expanded={table} onClick={() => setTable((v) => !v)}>{t(table ? 'wchart.hideTable' : 'wchart.showTable')}</button>
      {table ? (
        <div className="records-table weight-table">
          <table>
            <thead><tr><th>{t('wchart.date')}</th><th>{t('wchart.weighIn')}</th><th>{t('wchart.trend')}</th></tr></thead>
            <tbody>
              {[...pts].reverse().slice(0, 30).map((p) => (
                <tr key={p.date}><td>{formatDate(p.date)}</td><td>{t('wchart.kg', { kg: p.weight })}</td><td className="muted">{t('wchart.kg', { kg: p.trend.toFixed(1) })}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
