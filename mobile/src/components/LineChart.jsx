import { dateScale } from '../lib/chartScale.js';
import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';

/** Inline SVG line of { date, value } points, oldest first. */
export default function LineChart({ points, unit = 'kg', label = 'Trend', summary = null }) {
  if (points.length < 2) return <div className="empty small">Two sessions and a trend line shows up here.</div>;
  const W = 340;
  const H = 150;
  const P = 14;
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const pad = Math.max(1, (hi - lo) * 0.15);
  // By date (CHART-1): a long gap between sessions draws wide.
  const at = dateScale(points.map((p) => p.date), P, W - P);
  const x = (i) => at(points[i].date);
  const y = (v) => H - P - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('aria.lineChart', { label, from: vs[0], to: last.value, unit })}>
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill="var(--accent)" />)}
      </svg>
      <figcaption className="row between muted small"><span>{formatDate(points[0].date)}</span><span>{summary ?? `Best ${Math.max(...vs)} ${unit}`}</span><span>{formatDate(last.date)}</span></figcaption>
    </figure>
  );
}
