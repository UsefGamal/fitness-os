import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';

const ICON = { steps: 'steps', kcal: 'flame', sleep: 'moon' };

/** One card split into up to three numbers (steps, active kcal, sleep). */
export default function MetricStrip({ tiles }) {
  if (!tiles.length) return null;
  return (
    <section className="card metric-strip" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
      {tiles.map((x) => (
        <div key={x.key} className="metric">
          <Icon name={ICON[x.key]} className={`icon tone-${x.key}`} />
          <div className="metric-value">{x.value}</div>
          <div className="metric-label">{t(`home.tile.${x.key}`)}</div>
        </div>
      ))}
    </section>
  );
}
