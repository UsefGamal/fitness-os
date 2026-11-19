import { dateScale } from '../lib/chartScale.js';
import { t } from '../lib/i18n.js';

const weighed = (l) => l.weight_kg > 0;
const byDate = (a, b) => a.log_date.localeCompare(b.log_date);

/** Inline SVG line of weigh-ins, with the goal band shaded. */
export default function WeightChart({ logs: all, goalLow, goalHigh }) {
  // Weighed days only (a waist-only entry has no weight), oldest first.
  const logs = all.filter(weighed).sort(byDate);
  if (logs.length < 2) return <div className="empty small">Two weigh-ins and a trend line shows up here.</div>;
  const W = 340;
  const H = 160;
  const P = 12;
  const ws = logs.map((l) => l.weight_kg);
  const lo = Math.min(...ws, goalLow ?? Infinity) - 1;
  const hi = Math.max(...ws, goalHigh ?? -Infinity) + 1;
  // By date (CHART-1): a week with no weigh-ins draws a week wide.
  const at = dateScale(logs.map((l) => l.log_date), P, W - P);
  const x = (i) => at(logs[i].log_date);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const d = logs.map((l, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(l.weight_kg).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('aria.weightChart', { from: ws[0], to: ws[ws.length - 1] })}>
      {goalLow && goalHigh ? <rect x={P} width={W - 2 * P} y={y(goalHigh)} height={Math.max(1, y(goalLow) - y(goalHigh))} fill="color-mix(in srgb, var(--accent) 12%, transparent)" /> : null}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(logs.length - 1)} cy={y(ws[ws.length - 1])} r="4" fill="var(--accent)" />
    </svg>
  );
}
