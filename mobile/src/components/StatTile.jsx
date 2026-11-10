import { Link } from 'react-router';

import Icon from './Icon.jsx';

/** A quick-stat tile: icon, a number ("0 / 3000 ml") and a label. A link
 * when `to` is set; `children` go under it (the water buttons). */
export default function StatTile({ to, icon, tone, value, of, label, children, ariaLabel, wide = false }) {
  const cls = `stat-tile${wide ? ' wide' : ''}`;
  const inner = (
    <div className="row" style={{ gap: 12, flexWrap: wide ? 'wrap' : undefined }}>
      <Icon name={icon} className={`icon stat-icon tone-${tone}`} />
      <div className="grow">
        <div className="stat-tile-value">{value}{of ? <span className="of"> / {of}</span> : null}</div>
        <div className="stat-tile-label">{label}</div>
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className={cls} aria-label={ariaLabel}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
