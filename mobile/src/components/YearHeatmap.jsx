import { monthLabels } from '../lib/insights.js';

const LEVEL = ['var(--surface2)', 'rgba(48,209,88,0.45)', 'rgba(48,209,88,0.75)', '#30d158'];

/** A year of training days, GitHub style: one column per Sunday-start week.
 * Scrolls sideways on a phone, starting at this week. */
export default function YearHeatmap({ grid, onPick }) {
  const C = 12; // cell + gap
  const W = grid.length * C + 36; // room for the last month label
  const H = 7 * C + 16;
  const months = monthLabels(grid);
  return (
    <div className="heatmap" ref={(el) => { if (el) el.scrollLeft = el.scrollWidth; }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Training days over the last year">
        {months.map((m) => <text key={m.col} x={20 + m.col * C} y={9} fontSize="9" fill="#8e8e93">{m.label}</text>)}
        {['M', 'W', 'F'].map((l, i) => <text key={l} x={0} y={16 + (i * 2 + 1) * C + 9} fontSize="9" fill="#8e8e93">{l}</text>)}
        {grid.map((col, wi) => col.map((day, di) => (day.future ? null : (
          <rect key={day.date} x={20 + wi * C} y={16 + di * C} width={C - 2} height={C - 2} rx={2.5}
            fill={LEVEL[Math.min(3, day.count)]} onClick={onPick ? () => onPick(day) : undefined}>
            <title>{`${day.date}: ${day.count ? `${day.count} session${day.count > 1 ? 's' : ''}` : 'rest'}`}</title>
          </rect>
        ))))}
      </svg>
    </div>
  );
}
