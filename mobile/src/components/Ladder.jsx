import { Link } from 'react-router';

import { t } from '../lib/i18n.js';
import { exerciseIdFor, ladderFor, ladderRows } from '../lib/progressions.js';
import Icon from './Icon.jsx';

/** "Easier and harder": the ladder a bodyweight move is on
 * (content/progressions.py), with this move marked and the steps either
 * side labelled. Steps already in the Library open their page. */
export default function Ladder({ name, ladders, exercises }) {
  const found = ladderFor(name, ladders);
  if (!found) return null;
  const rows = ladderRows(found.ladder, found.index);
  return (
    <>
      <div className="section-label">{t('ladder.title')}</div>
      <div className="list">
        {rows.map((r, i) => {
          const id = r.place === 'current' ? null : exerciseIdFor(r.name, exercises);
          const tag = r.place === 'current' ? t('ladder.current') : i === found.index - 1 ? t('ladder.easier') : i === found.index + 1 ? t('ladder.harder') : null;
          const body = (
            <>
              <span className={`ladder-step ${r.place}`} aria-label={t('ladder.level', { n: r.level })}>{r.level}</span>
              <div className="grow">
                <div>{r.name}{tag ? <> <span className={`chip${r.place === 'current' ? ' accent' : ''}`}>{tag}</span></> : null}</div>
                <div className="meta">{r.cue}</div>
              </div>
              {id != null ? <Icon name="chev" className="icon chev" /> : null}
            </>
          );
          return id != null
            ? <Link key={r.name} to={`/library/${id}`} className="list-row">{body}</Link>
            : <div key={r.name} className={`list-row${r.place === 'current' ? ' ladder-current' : ''}`}>{body}</div>;
        })}
      </div>
      <p className="muted small" style={{ margin: '8px 16px 0' }}>{found.ladder.move_up}</p>
    </>
  );
}
