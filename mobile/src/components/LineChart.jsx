import { formatDate } from '../lib/dates.js';

/** Inline SVG line of { date, value } points, oldest first. */
export default function LineChart({ points, unit = 'kg', label = 'Trend' }) {
  if (points.length < 2) return <div className="empty small">Two sessions and a trend line shows up here.</div>;
  const W = 340;
  const H = 150;
  const P = 14;
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const x = (i) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${vs[0]} to ${last.value} ${unit}`}>
        <path d={d} fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill="#30d158" />)}
      </svg>
      <figcaption className="row between muted small"><span>{formatDate(points[0].date)}</span><span>Best {Math.max(...vs)} {unit}</span><span>{formatDate(last.date)}</span></figcaption>
    </figure>
  );
}
