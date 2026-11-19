import { Link } from 'react-router';

import Icon from './Icon.jsx';

/** A tile in a 2-column grid: icon, title, one line under it. */
export default function QuickAction({ to, onClick, icon, tone = 'accent', title, note, done = false }) {
  // With onClick it opens something in place (a sheet) instead of a page.
  const Tag = onClick ? 'button' : Link;
  const props = onClick ? { type: 'button', onClick } : { to };
  return (
    <Tag {...props} className="quick">
      <Icon name={icon} className={`icon tone-${tone}`} />
      <div className="grow">
        <div className="quick-title">{title}</div>
        <div className="quick-note">{note}</div>
      </div>
      {done ? <Icon name="check" className="icon tone-accent" /> : null}
    </Tag>
  );
}
