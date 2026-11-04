/** Inline SVG line of weigh-ins, with the goal band shaded. */
export default function WeightChart({ logs, goalLow, goalHigh }) {
  if (logs.length < 2) return <div className="empty small">Two weigh-ins and a trend line shows up here.</div>;
  const W = 340;
  const H = 160;
  const P = 12;
  const ws = logs.map((l) => l.weight_kg);
  const lo = Math.min(...ws, goalLow ?? Infinity) - 1;
  const hi = Math.max(...ws, goalHigh ?? -Infinity) + 1;
  const x = (i) => P + (i / (logs.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const d = logs.map((l, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(l.weight_kg).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Weight from ${ws[0]} to ${ws[ws.length - 1]} kg`}>
      {goalLow && goalHigh ? <rect x={P} width={W - 2 * P} y={y(goalHigh)} height={Math.max(1, y(goalLow) - y(goalHigh))} fill="rgba(48,209,88,0.12)" /> : null}
      <path d={d} fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(logs.length - 1)} cy={y(ws[ws.length - 1])} r="4" fill="#30d158" />
    </svg>
  );
}
